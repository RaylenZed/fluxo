import path from "node:path";
import type { NextConfig } from "next";

const allowedDevOrigins = ["127.0.0.1", "localhost", ...(process.env.ALLOWED_DEV_ORIGINS?.split(",").map((value) => value.trim()).filter(Boolean) ?? [])];

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins,
  turbopack: {
    root: path.resolve(process.cwd(), "../.."),
  },
};

export default nextConfig;
