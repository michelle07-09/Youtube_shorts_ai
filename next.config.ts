import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ── Standalone output — smaller Docker image, faster cold start on Railway ──
  output: "standalone",

  // Allow external image sources from AI providers
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "oaidalleapiprodscus.blob.core.windows.net" },
      { protocol: "https", hostname: "fal.media" },
      { protocol: "https", hostname: "**.fal.run" },
      { protocol: "https", hostname: "storage.googleapis.com" },
      { protocol: "https", hostname: "**.kling.ai" },
    ],
  },

  // Increase body size limit for video uploads
  experimental: {
    serverActions: {
      bodySizeLimit: "500mb",
    },
  },
};

export default nextConfig;
