import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  serverExternalPackages: ["pdf-parse"],
  outputFileTracingIncludes: {
    "/api/builder/parse-resume": ["./src/lib/builder/resume-pdf-worker.mjs", "./node_modules/pdf-parse/**/*", "./node_modules/pdfjs-dist/**/*", "./node_modules/@napi-rs/canvas/**/*", "./node_modules/@napi-rs/canvas-*/**/*"],
  },
};

export default nextConfig;
