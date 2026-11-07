import "server-only";

import { z } from "zod";
import { createPublicClient } from "@/lib/supabase/public-client";

const resolutionSchema = z.discriminatedUnion("tag_status", [
  z.object({ tag_status: z.literal("published"), public_slug: z.string().max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) }),
  z.object({ tag_status: z.enum(["inactive", "unavailable", "unbound"]), public_slug: z.null() }),
]);

export async function resolveTag(tagId: string) {
  const { data, error } = await createPublicClient().rpc("resolve_nfc_tag", { p_tag_id: tagId }).maybeSingle();
  if (error) throw new Error("NFC 태그를 확인하지 못했어요.", { cause: error.code });
  return data ? resolutionSchema.parse(data) : null;
}
