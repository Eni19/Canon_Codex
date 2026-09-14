import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  images: {
    // Wiki assets are protected by the active-Codex cookie. Next's server-side optimizer does
    // not forward that cookie, so every entity image must be requested directly by the browser.
    unoptimized: true,
    qualities: [75, 90],
  },
};

export default nextConfig;
