import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build enxuto para Docker (.next/standalone)
  output: "standalone",
  // Oculta o badge "N" do indicador de dev no canto da tela
  devIndicators: false,
};

export default nextConfig;
