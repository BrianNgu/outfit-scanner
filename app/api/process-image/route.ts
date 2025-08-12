// app/api/process-image/route.ts
import { NextRequest, NextResponse } from "next/server";
import vision from "@google-cloud/vision";
import path from "node:path";
import type { MatchItem } from "@/type/result";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---- toggles ----
const USE_SERPAPI = false;          // set true to spend credits
const LOG_RAW_VISION = true;        // verbose Vision logs to server console

// -------- Boot Vision client (supports 3 auth methods) --------
function getVisionClient() {
  // 1) Raw JSON in env var
  const raw = process.env.GOOGLE_CLOUD_CREDENTIALS;
  if (raw) {
    try {
      return new vision.ImageAnnotatorClient({ credentials: JSON.parse(raw) });
    } catch (e) {
      console.warn("Invalid GOOGLE_CLOUD_CREDENTIALS JSON:", e);
    }
  }

  // 2) Base64 JSON in env var
  const b64 = process.env.GCP_KEY_B64;
  if (b64) {
    try {
      const json = Buffer.from(b64, "base64").toString("utf8");
      return new vision.ImageAnnotatorClient({ credentials: JSON.parse(json) });
    } catch (e) {
      console.warn("Invalid GCP_KEY_B64 base64/JSON:", e);
    }
  }

  // 3) Local file path (dev)
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || "vision-key.json";
  return new vision.ImageAnnotatorClient({
    keyFilename: path.isAbsolute(keyPath) ? keyPath : path.join(process.cwd(), keyPath),
  });
}

const visionClient = getVisionClient();

// -------- Types --------
type Attributes = {
  brand?: string;
  category?: string;
  colors?: string[];
  patterns?: string[];
  texts?: string[];
};

// -------- Route --------
export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const debug = url.searchParams.get("debug") === "1";

    const form = await req.formData();
    const file = form.get("file") as File | null;
    const tiktokUrl = (form.get("tiktokUrl") as string) || "";

    if (!file && !tiktokUrl) {
      return NextResponse.json({ error: "Provide a file or a TikTok URL" }, { status: 400 });
    }

    // TikTok not wired yet – ask for screenshot
    if (!file && tiktokUrl) {
      return NextResponse.json({
        matches: [],
        note: "Upload a screenshot of the outfit moment for best results.",
      });
    }

    // File debug (name/type/size) to help spot HEIC/odd formats
    const fmeta = file
      ? { name: (file as any).name, type: (file as any).type, size: (file as any).size }
      : undefined;
    if (debug) {
      console.log("[upload meta]", fmeta);
    }

    // Read file -> Buffer
    const buf = Buffer.from(await (file as File).arrayBuffer());

    // 1) Extract attributes with Google Vision (guarded calls)
    const attributes = await extractAttributes(buf);

    // 2) Build a shopping query (requires brand or category)
    const query = buildQuery(attributes);

    // For debugging: show what we derived
    const projectId = await visionClient.getProjectId().catch(() => undefined);
    if (debug) {
      console.log("[process-image DEBUG]", {
        projectId,
        query,
        attributes,
      });
    }

    // If we couldn't build a meaningful query, return early
    if (!query) {
      return NextResponse.json(
        { matches: [], ...(debug ? { debug: { projectId, query, attributes, count: 0 } } : {}) },
        { status: 200 }
      );
    }

    // DRY RUN: don't hit SerpAPI unless USE_SERPAPI is true
    if (!USE_SERPAPI) {
      return NextResponse.json(
        { matches: [], ...(debug ? { debug: { projectId, query, attributes, count: 0, dry: true } } : {}) },
        { status: 200 }
      );
    }

    // 3) Search products via SerpAPI (Google Shopping)
    const matches = await searchShopping(query);

    return NextResponse.json(
      { matches, ...(debug ? { debug: { projectId, query, attributes, count: matches.length } } : {}) },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("process-image error:", err);
    return NextResponse.json({ error: err?.message ?? "Processing failed" }, { status: 500 });
  }
}

// -------- Vision helpers (guarded for optional methods) --------
async function extractAttributes(imageBuffer: Buffer): Promise<Attributes> {
  // Always-available calls
  const logoP = visionClient.logoDetection({ image: { content: imageBuffer } });
  const labelP = visionClient.labelDetection({ image: { content: imageBuffer } });
  const textP = visionClient.textDetection({ image: { content: imageBuffer } });

  // Optional methods on some versions of the SDK – guard them
  const webP =
    typeof (visionClient as any).webDetection === "function"
      ? (visionClient as any).webDetection({ image: { content: imageBuffer } })
      : Promise.resolve<[any]>([{}]);

  const objP =
    typeof (visionClient as any).objectLocalization === "function"
      ? (visionClient as any).objectLocalization({ image: { content: imageBuffer } })
      : Promise.resolve<[any]>([{}]);

  const propsP =
    typeof (visionClient as any).imageProperties === "function"
      ? (visionClient as any).imageProperties({ image: { content: imageBuffer } })
      : Promise.resolve<[any]>([{}]);

  const [logoRes, labelRes, textRes, webRes, objRes, propsRes] = await Promise.all([
    logoP,
    labelP,
    textP,
    webP,
    objP,
    propsP,
  ]);

  const logos = logoRes[0]?.logoAnnotations ?? [];
  const labels = labelRes[0]?.labelAnnotations ?? [];
  const texts = (textRes[0]?.textAnnotations ?? [])
    .map((t: any) => t.description?.trim())
    .filter(Boolean) as string[];

  const webEntities = (webRes[0]?.webDetection?.webEntities ?? [])
    .map((e: any) => e.description?.trim())
    .filter(Boolean) as string[];

  const objects = (objRes[0]?.localizedObjectAnnotations ?? [])
    .map((o: any) => o.name?.trim().toLowerCase())
    .filter(Boolean) as string[];

  // Rough color names from dominant colors
  const domColors = propsRes[0]?.imagePropertiesAnnotation?.dominantColors?.colors ?? [];
  const colorNames = domColors
    .slice(0, 5)
    .map((c: any) => approxColorName(c.color?.red ?? 0, c.color?.green ?? 0, c.color?.blue ?? 0))
    .filter(Boolean) as string[];

  if (LOG_RAW_VISION) {
    console.log("[vision raw counts]", {
      logos: logos.length,
      labels: labels.length,
      texts: texts.length,
      webEntities: webEntities.length,
      objects: objects.length,
      domColors: domColors.length,
    });
    console.log("[vision samples]", {
      labels: labels.map((l: any) => l.description).slice(0, 10),
      web: webEntities.slice(0, 10),
      texts: texts.slice(0, 5),
      objects: objects.slice(0, 10),
      colorNames,
    });
  }

  // Build searchable pools (lowercased)
  const logoWords = logos.map((l: any) => l.description ?? "");
  const labelWords = labels.map((l: any) => l.description ?? "");
  const pools = [...logoWords, ...labelWords, ...texts, ...webEntities, ...objects].map((s) =>
    (s || "").toLowerCase()
  );

  // Brand / category / pattern / colors
  const brand = normalizeBrand(pickBrandFromPools(pools));
  const category = pickCategoryFromPools(pools);
  const patterns = pickPatterns([...labelWords, ...webEntities].map((x) => x.toLowerCase()));
  const colors = Array.from(new Set([...(pickColors(pools) ?? []), ...colorNames])).slice(0, 3);

  return { brand, category, colors, patterns, texts };
}

// Try to recognize common brands from any pool text
function pickBrandFromPools(pools: string[]): string | undefined {
  const brandMap: Record<string, string> = {
    nike: "Nike",
    swoosh: "Nike",
    "just do it": "Nike",
    adidas: "Adidas",
    "three stripes": "Adidas",
    puma: "Puma",
    "the north face": "The North Face",
    "north face": "The North Face",
    patagonia: "Patagonia",
    "levi's": "Levi's",
    levis: "Levi's",
    uniqlo: "UNIQLO",
    zara: "Zara",
    "h&m": "H&M",
    hm: "H&M",
    "under armour": "Under Armour",
    "new balance": "New Balance",
    asics: "ASICS",
    vans: "Vans",
    converse: "Converse",
    reebok: "Reebok",
    supreme: "Supreme",
    stussy: "Stüssy",
    lululemon: "Lululemon",
    lulu: "Lululemon",
  };
  for (const s of pools) {
    for (const key in brandMap) {
      if (s.includes(key)) return brandMap[key];
    }
  }
  return undefined;
}

function normalizeBrand(b?: string) {
  if (!b) return undefined;
  return b;
}

function pickCategoryFromPools(pools: string[]): string | undefined {
  const cats = [
    ["t-shirt", "tee", "shirt", "jersey", "top"],
    ["hoodie", "sweatshirt"],
    ["jacket", "coat", "parka"],
    ["sweater", "knit", "cardigan"],
    ["dress"],
    ["skirt"],
    ["jeans", "denim"],
    ["pants", "trousers", "slacks", "chinos", "cargo"],
    ["shorts"],
    ["shoes", "sneakers", "trainers", "boots"],
    ["bag", "handbag", "backpack", "tote"],
    ["hat", "cap", "beanie"],
  ];
  for (const group of cats) {
    if (pools.some((s) => group.some((g) => s.includes(g)))) {
      return group[0]; // canonical
    }
  }
  return undefined;
}

// Existing helpers (still used by buildQuery / patterns / colors)
function pickColors(labelsLower: string[]): string[] {
  const palette = ["black", "white", "gray", "grey", "red", "blue", "green", "yellow", "pink", "purple", "brown", "beige", "tan", "orange"];
  const found = new Set<string>();
  for (const l of labelsLower) for (const c of palette) if (l.includes(c)) found.add(c);
  return [...found];
}

function pickPatterns(labelsLower: string[]): string[] {
  const pats = ["striped", "plaid", "checkered", "floral", "polka dot", "graphic", "logo", "solid"];
  const found = new Set<string>();
  for (const l of labelsLower) for (const p of pats) if (l.includes(p)) found.add(p);
  return [...found];
}

// rough color naming by nearest of a small palette
function approxColorName(r: number, g: number, b: number): string | undefined {
  const palette: Record<string, [number, number, number]> = {
    black: [0, 0, 0],
    white: [255, 255, 255],
    gray: [128, 128, 128],
    red: [220, 20, 60],
    blue: [65, 105, 225],
    green: [34, 139, 34],
    yellow: [255, 215, 0],
    pink: [255, 105, 180],
    purple: [138, 43, 226],
    brown: [139, 69, 19],
    beige: [245, 245, 220],
    orange: [255, 140, 0],
  };
  let best: string | undefined;
  let bestDist = Infinity;
  for (const name in palette) {
    const [pr, pg, pb] = palette[name];
    const d = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = name;
    }
  }
  return best;
}

// Avoid useless queries: require brand or category
function buildQuery(a: Attributes): string {
  // try to infer tee/t-shirt from OCR if category missing
  const txt = (a.texts ?? []).join(" ").toLowerCase();
  if (!a.category && /\b(t-?shirt|tee|shirt)\b/.test(txt)) a.category = "t-shirt";

  const parts: string[] = [];
  if (a.brand) parts.push(a.brand);
  if (a.category) parts.push(a.category);
  if (a.colors?.length) parts.push(a.colors[0]);
  if (a.patterns?.length) parts.push(a.patterns[0]);

  // Require at least brand or category; otherwise no query
  if (!a.brand && !a.category) return "";

  parts.push("buy"); // nudge shopping intent
  return parts.join(" ").trim();
}

// -------- SerpAPI search --------
async function searchShopping(query: string): Promise<MatchItem[]> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) throw new Error("Missing SERPAPI_KEY");

  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google_shopping");
  url.searchParams.set("q", query);
  url.searchParams.set("hl", "en");
  url.searchParams.set("gl", "us");
  url.searchParams.set("api_key", apiKey);

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error(`SerpAPI failed: ${res.status}`);
  const json = await res.json();

  const items = (json.shopping_results ?? []) as any[];
  const matches: MatchItem[] = items.slice(0, 12).map((it, i) => ({
    id: it.product_id ?? it.position ?? i,
    title: it.title,
    price:
      it.price ??
      (typeof it.extracted_price === "number" ? `$${it.extracted_price.toFixed(2)}` : undefined),
    store: it.source ?? it.domain,
    url: it.link,
    image: it.thumbnail,
    match: undefined,
  }));

  return matches;
}
