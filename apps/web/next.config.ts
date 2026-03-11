import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@enterprise-openclaw/shared"],
  env: {
    BACKEND_URL: process.env.BACKEND_URL ?? "http://localhost:3000",
  },
};

export default nextConfig;
