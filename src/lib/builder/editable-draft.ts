import { z } from "zod";
import { profileGenerationSchema } from "./profile-generation";

export const editableTextSchema = profileGenerationSchema.pick({ headline: true, competency_tags: true, project_summary: true, project_card: true });
export type EditableText = z.infer<typeof editableTextSchema>;
export const savedDraftSchema = z.object({
  id: z.string().uuid(), updatedAt: z.string(),
  original: editableTextSchema, current: editableTextSchema,
  objectGuide: profileGenerationSchema.shape.object_guide.optional(),
});
export type SavedDraft = z.infer<typeof savedDraftSchema>;
export const rewriteSchema = z.object({
  field: z.enum(["title", "skill_tag", "project_summary"]),
  currentText: z.string().trim().min(1).max(300),
  action: z.enum(["shorten", "change_tone", "emphasize_metrics"]),
  targetTone: z.enum(["professional", "bold", "approachable"]).optional(),
}).strict().superRefine((value, ctx) => {
  const max = value.field === "title" ? 60 : value.field === "skill_tag" ? 20 : 300;
  if (value.currentText.length > max) ctx.addIssue({ code: "custom", path: ["currentText"], message: "문구가 너무 깁니다." });
  if (value.action === "change_tone" && !value.targetTone) ctx.addIssue({ code: "custom", path: ["targetTone"], message: "말투를 선택해 주세요." });
  if (value.action === "emphasize_metrics" && value.field !== "project_summary") ctx.addIssue({ code: "custom", path: ["field"], message: "프로젝트 결과만 수치를 강조할 수 있어요." });
});
