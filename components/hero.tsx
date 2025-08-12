"use client"

import { Button } from "@/components/ui/button"
import Link from "next/link"

type HeroProps = {
  onStart: () => void
}

export default function Hero({ onStart }: HeroProps) {
  return (
    <section className="py-16 md:py-24">
      <div className="grid md:grid-cols-2 gap-12 items-center">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            Found the perfect outfit on TikTok?
            <span className="text-primary"> We'll find it for you.</span>
          </h1>
          <p className="mt-6 text-lg text-gray-600 leading-relaxed">
            Upload a screenshot or paste a TikTok link, and our AI will identify the clothing items and find you similar
            pieces from top retailers. No more endless scrolling through comments asking "where's this from?"
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <Button
              onClick={onStart}
              size="lg"
              className="rounded-full bg-primary hover:bg-primary/90 text-white"
            >
              Try it now
            </Button>

            <Link href="/how-it-works">
              <Button
                variant="outline"
                size="lg"
                className="rounded-full bg-transparent"
              >
                See how it works
              </Button>
            </Link>
          </div>

          <div className="mt-8 flex items-center gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span>Works with screenshots</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span>Paste TikTok links</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span>Find similar items</span>
            </div>
          </div>
        </div>

        <div className="relative">
          <div className="aspect-[9/16] max-w-sm mx-auto rounded-2xl overflow-hidden bg-black">
            <img
              src="/black.svg?height=600&width=300"
              alt="TikTok fashion video screenshot"
              className="object-cover w-full h-full"
            />
          </div>
          <div className="absolute -bottom-6 -right-6 bg-white p-4 rounded-xl shadow-lg">
            <p className="text-sm font-medium">Success rate</p>
            <p className="text-2xl font-bold text-primary">94%</p>
          </div>
        </div>
      </div>
    </section>
  )
}
