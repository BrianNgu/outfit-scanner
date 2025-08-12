export default function HowItWorksPage() {
    return (
      <main className="min-h-screen py-16 px-6 max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold mb-6">How It Works</h1>
        <p className="text-gray-700 mb-4">
          Upload a screenshot or TikTok link. Our AI identifies clothing items using computer vision,
          and finds similar products online — showing you price, name, and links to buy.
        </p>
        <ol className="list-decimal list-inside text-gray-600 space-y-2">
          <li>Upload or paste a TikTok link.</li>
          <li>Our AI scans for fashion pieces in the video or image.</li>
          <li>We return shopping links with similar items from popular stores.</li>
        </ol>
      </main>
    )
  }
  