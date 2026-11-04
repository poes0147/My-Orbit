import { z } from "zod";

export const projectSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().max(3000).default(""),
  link_url: z.url().regex(/^https?:\/\//i).max(2048).nullable().optional(),
  sort_order: z.number().int().min(0).default(0),
}).strict();
