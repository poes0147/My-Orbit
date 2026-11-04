import "server-only";

export function getProfileAiConfig() {
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-6-luna";
  return { apiKey: process.env.OPENAI_API_KEY, model, ...(model === "gpt-6-luna" ? { reasoning: { effort: "none" as const } } : {}) };
}
