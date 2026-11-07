import { z } from "zod";

export const tagIdSchema = z.string().regex(/^[A-Za-z0-9]{4,32}$/)
  .refine(id => id.toLowerCase() !== "bind");

export const registrationCodeSchema = z.string().max(48)
  .transform(value => value.trim().replaceAll("-", "").toLowerCase())
  .pipe(z.string().regex(/^[a-f0-9]{32}$/));

export const tagBindingPath = (tagId: string) => "/tags/bind/" + tagId;
