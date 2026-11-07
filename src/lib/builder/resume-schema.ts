import { z } from "zod";

export const MAX_RESUME_BYTES = 4 * 1024 * 1024;
export const MAX_RESUME_PAGES = 5;
export const resumeTextSchema = z.string().trim().min(50).max(8000);
const short = (max: number) => z.string().trim().max(max);
export const resumeProjectSchema = z.object({
  id: z.string().min(1).max(30), project_name: short(120), role: short(500),
  situation: short(500), action: short(500), result_outcome: short(500), is_primary: z.boolean(),
});
export const resumeAnalysisSchema = z.object({
  primary_experience: z.object({ category: short(120), keywords: z.array(z.string().trim().min(1).max(40)).max(5) }),
  projects: z.array(resumeProjectSchema).min(1).max(3),
  unmapped_notes: z.array(short(300)).max(5),
});
export type ResumeAnalysis = z.infer<typeof resumeAnalysisSchema>;
export type ResumeProject = z.infer<typeof resumeProjectSchema>;

export const resumeJsonSchema = {
  type: "object", additionalProperties: false,
  properties: {
    primary_experience: { type: "object", additionalProperties: false, properties: { category: { type: "string" }, keywords: { type: "array", items: { type: "string" }, maxItems: 5 } }, required: ["category", "keywords"] },
    projects: { type: "array", minItems: 1, maxItems: 3, items: { type: "object", additionalProperties: false,
      properties: { id: { type: "string" }, project_name: { type: "string" }, role: { type: "string" }, situation: { type: "string" }, action: { type: "string" }, result_outcome: { type: "string" }, is_primary: { type: "boolean" } },
      required: ["id", "project_name", "role", "situation", "action", "result_outcome", "is_primary"] } },
    unmapped_notes: { type: "array", items: { type: "string" }, maxItems: 5 },
  }, required: ["primary_experience", "projects", "unmapped_notes"],
} as const;

export function resumeToWizard(experience: string, keywords: string[], project: ResumeProject) {
  return { experience: project.project_name || experience, keywords: keywords.join(", "), situation: project.situation, role: project.role, action: project.action, result: project.result_outcome };
}
