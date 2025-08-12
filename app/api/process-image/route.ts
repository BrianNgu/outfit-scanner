// app/api/process-image/route.ts
import { NextRequest, NextResponse } from "next/server";
import vision from "@google-cloud/vision";
import path from "node:path";
import type { MatchItem } from "@/type/result";

export const runtime = "nodejs"; // file uploads + external fetch
export const dynamic = "force-dynamic";

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

    // Read file -> Buffer
    const buf = Buffer.from(await (file as File).arrayBuffer());

    // 1) Extract attributes with Google Vision
    const attributes = await extractAttributes(buf);

    // 2) Build a shopping query
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

    if (!query) {
      return NextResponse.json(
        { matches: [], ...(debug ? { debug: { projectId, query, attributes, count: 0 } } : {}) },
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

// -------- Vision helpers --------
async function extractAttributes(imageBuffer: Buffer): Promise<Attributes> {
  const [logoRes, labelRes, textRes] = await Promise.all([
    visionClient.logoDetection({ image: { content: imageBuffer } }),
    visionClient.labelDetection({ image: { content: imageBuffer } }),
    visionClient.textDetection({ image: { content: imageBuffer } }),
  ]);

  const logos = logoRes[0]?.logoAnnotations ?? [];
  const labels = labelRes[0]?.labelAnnotations ?? [];
  const texts = (textRes[0]?.textAnnotations ?? [])
    .map((t) => t.description?.trim())
    .filter(Boolean) as string[];

  const brand = logos[0]?.description || pickBrandFromText(texts);
  const labelStrings = labels.map((l) => (l.description ?? "").toLowerCase());

  const category = pickCategory(labelStrings);
  const colors = pickColors(labelStrings);
  const patterns = pickPatterns(labelStrings);

  return { brand, category, colors, patterns, texts };
}

function pickBrandFromText(texts: string[]): string | undefined {
  const joined = texts.join(" ").replace(/\s+/g, " ");
  const known = ["ADIDAS", "NIKE", "ZARA", "H&M", "MANGO", "UNIQLO", "GUCCI", "PRADA", "BALENCIAGA", "SUPREME"];
  for (const b of known) if (joined.toUpperCase().includes(b)) return b;
  const caps = joined.match(/\b[A-Z]{3,}\b/g);
  return caps?.[0];
}

function pickCategory(labelsLower: string[]): string | undefined {
  const cats = [
    "jacket","hoodie","coat","sweater","shirt","t-shirt","tee","blazer","dress",
    "skirt","jeans","pants","trousers","shorts","shoes","sneakers","boots","bag","hat"
  ];
  return cats.find((c) => labelsLower.some((l) => l.includes(c)));
}

function pickColors(labelsLower: string[]): string[] {
  const palette = ["black","white","gray","grey","red","blue","green","yellow","pink","purple","brown","beige","tan","orange"];
  const found = new Set<string>();
  for (const l of labelsLower) for (const c of palette) if (l.includes(c)) found.add(c);
  return [...found];
}

function pickPatterns(labelsLower: string[]): string[] {
  const pats = ["striped","plaid","checkered","floral","polka dot","graphic","logo","solid"];
  const found = new Set<string>();
  for (const l of labelsLower) for (const p of pats) if (l.includes(p)) found.add(p);
  return [...found];
}

function buildQuery(a: Attributes): string {
  const parts: string[] = [];
  if (a.brand) parts.push(a.brand);
  if (a.category) parts.push(a.category);
  if (a.colors?.length) parts.push(a.colors[0]);
  if (a.patterns?.length) parts.push(a.patterns[0]);
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
