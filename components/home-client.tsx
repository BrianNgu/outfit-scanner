"use client";

import { useState } from "react";
import Hero from "@/components/hero";
import UploadSection from "@/components/upload-section";
import ResultsSection from "@/components/results-section";
import type { MatchItem } from "@/type/result";

export default function HomeClient() {
  const [stage, setStage] = useState<"hero" | "upload" | "results">("hero");
  const [results, setResults] = useState<MatchItem[]>([]);

  const handleStart = () => setStage("upload");

  const handleUploadComplete = (matches: MatchItem[]) => {
    setResults(matches ?? []);
    setStage("results");
  };

  return (
    <>
      {stage === "hero" && <Hero onStart={handleStart} />}
      {stage === "upload" && <UploadSection onComplete={handleUploadComplete} />}
      {stage === "results" && <ResultsSection results={results} />}
    </>
  );
}
