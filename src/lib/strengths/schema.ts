import { z } from 'zod';

export const experienceSchema = z.object({
  id: z.string().trim().min(1).max(40), title: z.string().trim().min(1).max(120),
  role: z.string().trim().max(500), problem: z.string().trim().max(500),
  action: z.string().trim().min(5).max(500), outcome: z.string().trim().max(500),
}).strict();
export type StrengthExperience = z.infer<typeof experienceSchema>;
export const strengthInputSchema = z.object({ experiences: z.array(experienceSchema).min(1).max(4)
  .refine(items => new Set(items.map(item => item.id)).size === items.length, '경험 ID 중복') }).strict();
export const extractionSchema = z.object({
  experienceId: z.string().max(40), strengthId: z.string().max(60),
  field: z.enum(['role', 'problem', 'action', 'outcome']), quote: z.string().trim().min(5).max(500),
  actor: z.enum(['self', 'other', 'unclear']), modality: z.enum(['performed', 'negated', 'aspiration', 'trait', 'unclear']),
}).strict();
export type StrengthExtraction = z.infer<typeof extractionSchema>;
export const extractionOutputSchema = z.object({ extractions: z.array(extractionSchema).max(48) }).strict();
export const strengthResultSchema = z.object({
  strengthId: z.string(), name: z.string(), clusterName: z.string(), reason: z.string(), distinctExperienceCount: z.number().int().min(1),
  evidences: z.array(z.object({ quote: z.string(), experienceTitle: z.string(), experienceId: z.string(), field: z.string() })).min(1).max(8),
});
export const analysisDataSchema = z.object({
  analysisId: z.uuid(), inputHash: z.string(), isCached: z.boolean(), expiresAt: z.string(),
  recommendedStrengths: z.array(strengthResultSchema).max(3), followUpQuestions: z.array(z.string()).max(3),
});
export type StrengthAnalysis = z.infer<typeof analysisDataSchema>;
export const selectedStrengthTagsSchema = z.array(z.string().trim().min(2).max(15).regex(/^[^\r\n]+$/)).max(3)
  .refine(tags => new Set(tags.map(tag => tag.normalize('NFKC').toLowerCase().replace(/\s+/g, ''))).size === tags.length, '서로 다른 태그를 입력해 주세요.');
