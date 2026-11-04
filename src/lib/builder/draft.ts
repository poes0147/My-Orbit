import { z } from "zod";

export const valueOptions = ["성장", "협업", "창의성", "문제 해결", "꾸준함", "새로운 도전"] as const;
export const toneOptions = { professional: "차분하고 전문적으로", challenging: "도전적이고 자신 있게", authentic: "진솔하고 신뢰감 있게", creative: "창의적이고 위트 있게" } as const;
export const initialDraft = { experience: "", keywords: "", situation: "", role: "", action: "", result: "", values: [] as string[], tone: "" };
export type Draft = typeof initialDraft;
export type DraftErrors = Partial<Record<keyof Draft, string>>;
const text = (max: number) => z.string().max(max, `${max}자 이내로 입력해 주세요.`);
export const storageDraftSchema = z.object({
  experience: text(120), keywords: text(200), situation: text(500), role: text(500), action: text(500), result: text(500),
  values: z.array(z.enum(valueOptions)).max(3), tone: z.union([z.enum(Object.keys(toneOptions) as [string, ...string[]]), z.literal("")]),
});
export const keywordList = (input: string) => [...new Set(input.split(/[,，\n]/).map(value => value.trim()).filter(Boolean))];
const stepSchemas = [
  z.object({ experience: text(120).trim().min(1, "경험 또는 프로젝트 이름을 입력해 주세요."), keywords: text(200).refine(value => keywordList(value).length >= 1 && keywordList(value).length <= 5, "키워드를 쉼표로 구분해 1~5개 입력해 주세요.") }),
  z.object({ situation: text(500).trim().min(1, "어떤 상황이었는지 입력해 주세요."), role: text(500).trim().min(1, "역할과 목표를 입력해 주세요."), action: text(500).trim().min(20, "내가 한 행동을 20자 이상 입력해 주세요."), result: text(500).trim().min(10, "결과와 배운 점을 10자 이상 입력해 주세요.") }),
  z.object({ values: z.array(z.enum(valueOptions)).min(1, "중요한 가치를 하나 이상 골라 주세요.").max(3), tone: z.enum(["professional", "challenging", "authentic", "creative"], { error: "소개할 때 사용할 말투를 골라 주세요." }) }),
];
export function validateDraft(draft: Draft, step: number): DraftErrors {
  const result = stepSchemas[step].safeParse(draft);
  if (result.success) return {};
  const errors: DraftErrors = {};
  for (const issue of result.error.issues) errors[issue.path[0] as keyof Draft] = issue.message;
  return errors;
}
export function createWizardPayload(draft: Draft, workshopSessionId: string | null) {
  return { workshopSessionId, stepData: { keywords: keywordList(draft.keywords), project: { title: draft.experience.trim(), role: draft.role.trim(), problem: draft.situation.trim(), action: draft.action.trim(), outcome: draft.result.trim() }, persona: { coreValues: draft.values, tone: draft.tone } } };
}
export type WizardPayload = ReturnType<typeof createWizardPayload>;
export function restoreDraft(raw: string | null) {
  if (!raw) return null;
  try {
    const result = z.object({ version: z.literal(1), draft: storageDraftSchema, step: z.number().int().min(0).max(2), review: z.boolean() }).safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch { return null; }
}
