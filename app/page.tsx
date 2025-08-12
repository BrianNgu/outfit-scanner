import type { Metadata } from "next"
import HomeClient from "@/components/home-client"
import Link from "next/link"
export const metadata: Metadata = {
  title: "Outfit Scanner | Find that TikTok outfit instantly",
  description: "Upload TikTok screenshots or paste links to identify and shop similar clothing items",
}

export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      <div className="container max-w-6xl mx-auto px-4 py-8">
        <header className="flex justify-between items-center mb-12">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center">
              <span className="text-white font-semibold text-lg">OS</span>
            </div>
            <h1 className="text-xl font-semibold">Outfit Scanner</h1>
          </div>
          <nav>
            <ul className="flex gap-6">
              <li>
                <Link href="/how-it-works" className="text-sm font-medium hover:text-gray-600">
                  How it works
                </Link>
              </li>
              <li><a href="#" className="text-sm font-medium hover:text-gray-600">About</a></li>
              <li><a href="#" className="text-sm font-medium hover:text-gray-600">Contact</a></li>
            </ul>
          </nav>
        </header>

        <HomeClient />
      </div>

      <footer className="border-t mt-24 py-8">
        <div className="container max-w-6xl mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-sm text-gray-500">© 2025 Outfit Scanner. All rights reserved.</p>
            <div className="flex gap-6 mt-4 md:mt-0">
              <a href="#" className="text-sm text-gray-500 hover:text-gray-800">Privacy Policy</a>
              <a href="#" className="text-sm text-gray-500 hover:text-gray-800">Terms of Service</a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  )
}
