import app from "../../../../package.json";
import { readRuntimeEnv } from "@/lib/runtime-env";
import { createPublicClient } from "@/lib/supabase/public-client";

export async function GET(request: Request) {
  let connected = false;
  let aiReady = false;
  try {
    const env = readRuntimeEnv();
    aiReady = Boolean(env.OPENAI_API_KEY);
    const { error } = await createPublicClient().from("profiles").select("id", { head: true })
      .limit(1).abortSignal(AbortSignal.any([request.signal, AbortSignal.timeout(3000)]));
    connected = !error;
  } catch {
    // The public endpoint returns service states only.
  }

  return Response.json({
    status: !connected ? "unhealthy" : aiReady ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    services: { database: connected ? "connected" : "disconnected", ai_gateway: aiReady ? "ready" : "unconfigured" },
    version: app.version,
  }, { status: connected ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
