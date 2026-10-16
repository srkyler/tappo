import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build enxuto para Docker (.next/standalone)
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  // Oculta o badge "N" do indicador de dev no canto da tela
  devIndicators: false,
  turbopack: {
    // Evita que o Next adote o package-lock.json solto em C:\Users\User como raiz
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
