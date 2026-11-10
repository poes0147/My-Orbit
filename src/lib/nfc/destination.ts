import { z } from "zod";

const hostnamePattern = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/;
const reservedSuffix = /\.(localhost|local|internal|home|lan|test|invalid|onion|example|arpa)$/;

function publicHttpsUrl(value: string) {
  if (!/^https:\/\//i.test(value) || /[\s\\\x00-\x1f\x7f]/.test(value)) return null;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && !url.username && !url.password && !url.port
      && url.hostname.length <= 253 && hostnamePattern.test(url.hostname) && !reservedSuffix.test(url.hostname)
      && url.href.length <= 500) return url.href;
  } catch {
    return null;
  }
  return null;
}

export const externalDestinationSchema = z.string().trim().max(500)
  .transform((value, context) => {
    const url = publicHttpsUrl(value);
    if (url) return url;
    context.addIssue({ code: "custom", message: "공개 HTTPS 웹 주소를 입력해 주세요." });
    return z.NEVER;
  });

const common = { alias: z.string().trim().max(40).regex(/^[^\x00-\x1f\x7f]*$/).nullable().optional(), acknowledged: z.boolean().optional() };
export const tagDestinationInputSchema = z.discriminatedUnion("target_type", [
  z.object({ ...common, target_type: z.literal("profile"), custom_url: z.null().optional() }).strict(),
  z.object({ ...common, target_type: z.literal("custom_url"), custom_url: externalDestinationSchema, acknowledged: z.literal(true) }).strict(),
  z.object({ ...common, target_type: z.literal("contact_card"), card_id: z.uuid(), acknowledged: z.literal(true) }).strict(),
  z.object({ ...common, target_type: z.literal("none") }).strict(),
]);

export const tagDestinationFields = "tag_id,is_active,target_type,custom_url,card_id,alias,updated_at";

export const tagDestinationSchema = z.object({
  tag_id: z.string(),
  is_active: z.boolean(),
  updated_at: z.string(),
  alias: z.string().nullable(),
  card_id: z.uuid().nullable(),
  custom_url: z.string().nullable(),
  target_type: z.enum(["profile", "custom_url", "contact_card", "none"]),
});

export type TagDestination = z.output<typeof tagDestinationSchema>;
