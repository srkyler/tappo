import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build enxuto para Docker (.next/standalone)
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  // Oculta o badge "N" do indicador de dev no canto da tela
  devIndicators: false,
  turbopack: {
    root: "C:\\Users\\User\\Documents\\Tappo\\tappo",
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
