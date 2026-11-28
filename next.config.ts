import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sem o indicador redondo do Next no canto da tela em desenvolvimento; erros continuam aparecendo.
  devIndicators: false,
  outputFileTracingExcludes: {
    '/*': ['./workspace/**/*', './**/*.sqlite', './**/*.sqlite-*'],
  },
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
