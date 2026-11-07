import { randomInt } from "node:crypto";

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateWorkshopCode() {
  return Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join("");
}

// Only a unique-code collision is retryable; authorization/network errors must surface.
export async function withCodeRetry<T>(create: (code: string) => Promise<{ data: T; error: { code?: string } | null }>) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const result = await create(generateWorkshopCode());
    if (result.error?.code !== "23505") return result;
    if (attempt < 4) await new Promise(resolve => setTimeout(resolve, 20 * 2 ** attempt));
  }
  return { data: null, error: { code: "CODE_COLLISION" } };
}
