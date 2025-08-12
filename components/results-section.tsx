"use client";

import { useState } from "react";
import type { MatchItem } from "@/type/result";
import { ExternalLink, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ResultsSectionProps = { results: MatchItem[] };

export default function ResultsSection({ results }: ResultsSectionProps) {
  const [favorites, setFavorites] = useState<(string | number)[]>([]);
  const hasResults = Array.isArray(results) && results.length > 0;

  const toggleFavorite = (id?: string | number) => {
    if (id == null) return;
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const formatPrice = (price?: string | number) => {
    if (typeof price === "number") return `$${price.toFixed(2)}`;
    if (typeof price === "string") return price;
    return undefined;
  };

  return (
    <section id="results" className="py-16">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-bold">Similar Items Found</h2>
        <p className="mt-3 text-gray-600">
          {hasResults
            ? "Here are items that match your upload"
            : "No matches yet — try another image or clearer frame"}
        </p>
      </div>

      {!hasResults ? (
        <div className="text-center py-12 text-gray-500">No results to show.</div>
      ) : (
        <Tabs defaultValue="all" className="w-full">
          <div className="flex justify-center mb-8">
            <TabsList className="rounded-full">
              <TabsTrigger value="all" className="rounded-full">All Items</TabsTrigger>
              <TabsTrigger value="tops" className="rounded-full">Tops</TabsTrigger>
              <TabsTrigger value="bottoms" className="rounded-full">Bottoms</TabsTrigger>
              <TabsTrigger value="accessories" className="rounded-full">Accessories</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="all" className="mt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {results.map((item, idx) => {
                const id = item.id ?? idx;
                const title = item.title ?? (item as any).name ?? "Item";
                const price = formatPrice(item.price);

                return (
                  <div
                    key={id}
                    className="group relative bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="absolute top-3 right-3 z-10">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-full bg-white/80 backdrop-blur-sm hover:bg-white"
                        onClick={() => toggleFavorite(id)}
                      >
                        <Heart
                          className={`w-5 h-5 ${
                            favorites.includes(id)
                              ? "fill-red-500 text-red-500"
                              : "text-gray-600"
                          }`}
                        />
                        <span className="sr-only">Add to favorites</span>
                      </Button>
                    </div>

                    <div className="aspect-[3/4] relative">
                      <img
                        src={item.image || "/placeholder.jpg"}
                        alt={title}
                        className="object-cover w-full h-full"
                      />
                      {typeof item.match === "number" && (
                        <div className="absolute top-3 left-3 bg-primary text-primary-foreground text-xs font-medium px-2 py-1 rounded-full">
                          {item.match}% similar
                        </div>
                      )}
                    </div>

                    <div className="p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-medium text-lg">{title}</h3>
                          {item.store && (
                            <p className="text-sm text-gray-500">{item.store}</p>
                          )}
                        </div>
                        {price && <p className="font-semibold">{price}</p>}
                      </div>

                      {item.url && (
                        <div className="mt-4">
                          <a href={item.url} target="_blank" rel="noreferrer">
                            <Button className="w-full rounded-full bg-primary hover:bg-primary/80 text-primary-foreground">
                              Shop Now <ExternalLink className="w-4 h-4 ml-2" />
                            </Button>
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* Placeholder tabs for future filtering */}
          <TabsContent value="tops" className="mt-0">
            <div className="text-center py-12 text-gray-500">Filter by tops to see similar items</div>
          </TabsContent>
          <TabsContent value="bottoms" className="mt-0">
            <div className="text-center py-12 text-gray-500">Filter by bottoms to see similar items</div>
          </TabsContent>
          <TabsContent value="accessories" className="mt-0">
            <div className="text-center py-12 text-gray-500">Filter by accessories to see similar items</div>
          </TabsContent>
        </Tabs>
      )}
    </section>
  );
}
