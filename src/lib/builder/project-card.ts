import { z } from "zod";

export const projectCardFields = {
  context_line: "상황·과업",
  action_line: "행동",
  result_line: "결과",
} as const;

const line = z.string().trim().min(1).max(180).regex(/^[^\r\n]+$/);
export const projectLinesSchema = z.object({ context_line: line, action_line: line, result_line: line });
export const starCardSchema = projectLinesSchema.extend({ role: z.string().trim().min(1).max(500) });
export const projectCardSchema = starCardSchema.extend({
  title: z.string().trim().min(1).max(120),
  link_url: z.url().regex(/^https?:\/\//i).max(2048).nullable(),
});
export const projectCardInputSchema = z.object({
  profile_id: z.uuid().nullish(),
  project_name: z.string().trim().min(1).max(120),
  role: z.string().trim().min(1).max(500),
  raw_problem: z.string().trim().min(1).max(500),
  raw_action: z.string().trim().min(20).max(500),
  raw_result: z.string().trim().min(10).max(500),
}).strict();

export type ProjectCard = z.infer<typeof projectCardSchema>;
export type ProjectCardInput = z.infer<typeof projectCardInputSchema>;
export type ProjectLine = keyof typeof projectCardFields;

export function cleanProjectLine(value: string) {
  const text = value.replace(/\s+/g, " ").trim();
  const firstSentence = text.match(/^.*?[.!?。！？](?=\s|$)/)?.[0] ?? text;
  const clipped = firstSentence.slice(0, 179).trimEnd();
  return /[.!?。！？]$/.test(clipped) ? clipped : clipped + (firstSentence.length > 179 ? "…" : ".");
}

export function fallbackProjectLines(input: ProjectCardInput) {
  return {
    context_line: cleanProjectLine(input.raw_problem),
    action_line: cleanProjectLine(input.raw_action),
    result_line: cleanProjectLine(input.raw_result),
  };
}
