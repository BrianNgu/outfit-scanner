"use client";

import type React from "react";
import { useRef, useState } from "react";
import { Upload, ImagePlus, Link as LinkIcon, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { MatchItem } from "@/type/result";

type Props = {
  onComplete: (matches: MatchItem[]) => void;
};

export default function UploadSection({ onComplete }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [tiktokUrl, setTiktokUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeTab, setActiveTab] = useState("screenshot");

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const openFilePicker = () => fileInputRef.current?.click();

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) handleFile(e.target.files[0]);
  };

  const handleFile = (file: File) => {
    setFile(file);
    handleScan(file);
  };

  const handleScan = async (file: File) => {
    setIsUploading(true);
    setProgress(0);

    const formData = new FormData();
    formData.append("file", file);

    try {
      // DEBUG: add ?debug=1
      const res = await fetch("/api/process-image?debug=1", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error(`Upload failed with status ${res.status}`);

      const data = await res.json();

      // DEBUG: log what server derived
      // Expect data.debug = { projectId, query, attributes, count }
      // eslint-disable-next-line no-console
      console.log("process-image debug (screenshot):", data.debug ?? data);

      const matches: MatchItem[] = Array.isArray(data?.matches)
        ? data.matches
        : Array.isArray(data?.items)
        ? data.items
        : [];

      setProgress(100);
      setTimeout(() => {
        setIsUploading(false);
        onComplete(matches);
        document.getElementById("results")?.scrollIntoView({ behavior: "smooth" });
      }, 300);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Error scanning outfit:", err);
      setIsUploading(false);
      onComplete([]);
    }
  };

  const handleTikTokSubmit = async () => {
    if (!tiktokUrl.trim()) return;
    setIsUploading(true);
    setProgress(0);

    try {
      const formData = new FormData();
      formData.append("tiktokUrl", tiktokUrl.trim());

      // DEBUG: add ?debug=1
      const res = await fetch("/api/process-image?debug=1", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);

      const data = await res.json();

      // DEBUG
      // eslint-disable-next-line no-console
      console.log("process-image debug (tiktok):", data.debug ?? data);

      const matches: MatchItem[] = Array.isArray(data?.matches) ? data.matches : [];

      setProgress(100);
      setTimeout(() => {
        setIsUploading(false);
        onComplete(matches);
        document.getElementById("results")?.scrollIntoView({ behavior: "smooth" });
      }, 300);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      setIsUploading(false);
      onComplete([]);
    }
  };

  return (
    <section id="upload" className="py-16">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-bold">Identify That TikTok Outfit</h2>
        <p className="mt-3 text-gray-600">
          Upload a screenshot or paste a TikTok link to find similar clothing
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full max-w-2xl mx-auto">
        <div className="flex justify-center mb-8">
          <TabsList className="rounded-full">
            <TabsTrigger value="screenshot" className="rounded-full">
              <Smartphone className="w-4 h-4 mr-2" />
              Screenshot
            </TabsTrigger>
            <TabsTrigger value="link" className="rounded-full">
              <LinkIcon className="w-4 h-4 mr-2" />
              TikTok Link
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Screenshot Tab */}
        <TabsContent value="screenshot" className="mt-0">
          <div
            className={cn(
              "border-2 border-dashed rounded-2xl p-12 transition-all duration-200 text-center",
              isDragging ? "border-primary bg-primary/10" : "border-gray-300",
              isUploading ? "pointer-events-none opacity-80" : "hover:border-gray-400"
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {!file && !isUploading ? (
              <>
                <div className="mx-auto w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-4">
                  <Upload className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-medium">Drop your TikTok screenshot here</h3>
                <p className="text-gray-500 mt-2 mb-6">or click to browse from your device</p>
                <Button
                  onClick={openFilePicker}
                  className="rounded-full cursor-pointer bg-primary hover:bg-primary/80 text-primary-foreground"
                >
                  <ImagePlus className="w-4 h-4 mr-2" />
                  Choose Screenshot
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileInput}
                />
                <p className="text-xs text-gray-400 mt-6">
                  Works best with clear, full-body outfit shots
                </p>
              </>
            ) : (
              <div className="max-w-md mx-auto">
                <h3 className="text-lg font-medium mb-4">
                  {isUploading ? "Analyzing the outfit..." : "Screenshot uploaded!"}
                </h3>
                {file && (
                  <div className="relative w-40 h-40 mx-auto mb-4 rounded-lg overflow-hidden">
                    <img
                      src={URL.createObjectURL(file)}
                      alt="TikTok screenshot"
                      className="object-cover w-full h-full"
                    />
                  </div>
                )}
                {isUploading && (
                  <div className="mt-6">
                    <Progress value={progress} className="h-2" />
                    <div className="flex justify-between mt-2 text-sm text-gray-500">
                      <span>Identifying clothing items...</span>
                      <span>{progress}%</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Link Tab */}
        <TabsContent value="link" className="mt-0">
          <div className="border-2 border-dashed border-gray-300 rounded-2xl p-12 text-center">
            {!isUploading ? (
              <>
                <div className="mx-auto w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-4">
                  <LinkIcon className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-medium mb-4">Paste your TikTok link</h3>
                <div className="max-w-md mx-auto space-y-4">
                  <Input
                    type="url"
                    placeholder="https://www.tiktok.com/@username/video/..."
                    value={tiktokUrl}
                    onChange={(e) => setTiktokUrl(e.target.value)}
                    className="rounded-full"
                  />
                  <Button
                    onClick={handleTikTokSubmit}
                    disabled={!tiktokUrl.trim()}
                    className="rounded-full bg-primary hover:bg-primary/80 text-primary-foreground"
                  >
                    Analyze TikTok Video
                  </Button>
                </div>
                <p className="text-xs text-gray-400 mt-6">
                  We'll extract frames from the video to identify outfits
                </p>
              </>
            ) : (
              <div className="max-w-md mx-auto">
                <h3 className="text-lg font-medium mb-4">Processing TikTok video...</h3>
                <div className="mt-6">
                  <Progress value={progress} className="h-2" />
                  <div className="flex justify-between mt-2 text-sm text-gray-500">
                    <span>Extracting frames and analyzing...</span>
                    <span>{progress}%</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}
