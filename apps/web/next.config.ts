import "@solved-problems/env/web";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  reactCompiler: true,
  output: "standalone",
  outputFileTracingRoot: "../../",
};

export default nextConfig;
