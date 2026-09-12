import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  images: {
    // Next.js 16 only serves quality 75 unless explicitly allow-listed. 90 is used for the
    // character portrait hero, where sharpness matters more than for thumbnails/cards.
    qualities: [75, 90],
  },
};

export default nextConfig;
