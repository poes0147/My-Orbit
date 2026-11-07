import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD } from "next/constants";
import { publicStoragePattern } from "./src/modules/public-profile/avatar-source";
import { readRuntimeEnv } from "./src/lib/runtime-env";

const storagePattern = publicStoragePattern(process.env.NEXT_PUBLIC_SUPABASE_URL);

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  images: { remotePatterns: storagePattern ? [storagePattern] : [] },
  serverExternalPackages: ["pdf-parse"],
  outputFileTracingIncludes: {
    "/api/builder/parse-resume": ["./src/lib/builder/resume-pdf-worker.mjs", "./node_modules/pdf-parse/**/*", "./node_modules/pdfjs-dist/**/*", "./node_modules/@napi-rs/canvas/**/*", "./node_modules/@napi-rs/canvas-*/**/*"],
  },
};

export default function config(phase: string): NextConfig {
  if (phase === PHASE_PRODUCTION_BUILD) readRuntimeEnv();
  const dev = phase === PHASE_DEVELOPMENT_SERVER;
  const policy = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://vercel.live" + (dev ? " 'unsafe-eval'" : ""),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co https://vercel.live" + (dev ? " ws: wss:" : ""),
    "frame-src https://vercel.live",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
  return {
    ...nextConfig,
    async headers() {
      return [{ source: "/:path*", headers: [
        { key: "Content-Security-Policy", value: policy },
        ...(!dev ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" }] : []),
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
      ] }];
    },
  };
}
