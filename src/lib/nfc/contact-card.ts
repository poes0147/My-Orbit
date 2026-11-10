import { z } from "zod";
import { externalDestinationSchema } from "./destination";

const text = (max: number) => z.string().trim().max(max).regex(/^[^\x00-\x1f\x7f]*$/, "줄바꿈이나 제어 문자는 사용할 수 없어요.");
const optional = (schema: z.ZodType<string>) => z.preprocess(value => value === "" || value === undefined ? null : value, schema.nullable());
export const contactCardInputSchema = z.object({
  card_name: text(40).min(1), display_name: text(80).min(1),
  phone_number: optional(text(40).regex(/^\+?[0-9() .-]+$/).regex(/[0-9]/)),
  email: optional(text(254).email()), organization_name: optional(text(100)),
  job_title: optional(text(100)), website_url: optional(externalDestinationSchema),
}).strict();
export const contactCardSchema = contactCardInputSchema.extend({ id: z.uuid(), updated_at: z.string() });
export const contactCardFields = "id,card_name,display_name,phone_number,email,organization_name,job_title,website_url,updated_at";
export type ContactCard = z.output<typeof contactCardSchema>;
export const hasContact = (card: Pick<ContactCard, "phone_number" | "email">) => Boolean(card.phone_number || card.email);
