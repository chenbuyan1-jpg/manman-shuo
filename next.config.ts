import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: ".next-manman",
  typescript: {
    ignoreBuildErrors: false
  }
};

export default nextConfig;
