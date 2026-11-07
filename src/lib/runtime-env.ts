import { z } from "zod";

const httpsOrigin = z.url().refine(value => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash;
  } catch {
    return false;
  }
});

const publicKey = z.string().refine(value => {
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(value)) return true;
  try {
    const parts = value.split(".");
    return parts.length === 3 && JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")).role === "anon";
  } catch {
    return false;
  }
});

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: httpsOrigin,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publicKey,
  NEXT_PUBLIC_APP_URL: httpsOrigin.optional(),
  OPENAI_API_KEY: z.string().trim().min(1).optional(),
}).superRefine((value, context) => {
  if (process.env.VERCEL_ENV !== "production") return;
  for (const key of ["NEXT_PUBLIC_APP_URL", "OPENAI_API_KEY"] as const) {
    if (!value[key]) context.addIssue({ code: "custom", path: [key], message: "Required on Vercel Production" });
  }
});

export function readRuntimeEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const keys = [...new Set(result.error.issues.map(issue => issue.path.join(".")))];
    throw new Error("Invalid or missing runtime environment variables: " + keys.join(", "));
  }
  return result.data;
}
