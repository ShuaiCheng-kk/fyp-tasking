import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  generateBuildId: async () => `build-${Date.now()}`,
  serverExternalPackages: ['openai'],
};

export default nextConfig;
