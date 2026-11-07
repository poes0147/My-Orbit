import { z } from "zod";

export const titleTagsSchema = z.object({
  professionalTitle: z.string().trim().min(5).max(60).regex(/^[^\r\n]+$/),
  coreCompetencies: z.array(z.string().trim().min(2).max(15).regex(/^[^\r\n]+$/)).length(3)
    .refine(tags => new Set(tags.map(tag => tag.normalize("NFKC").toLowerCase().replace(/\s+/g, ""))).size === 3,
      "서로 다른 핵심 역량 3개를 입력해 주세요."),
});

export type TitleTags = z.infer<typeof titleTagsSchema>;

const defaultTitles = {
  professional: "경험을 바탕으로 문제를 해결하는 실행가",
  challenging: "새로운 도전에 앞장서는 실행가",
  authentic: "꾸준한 실행으로 신뢰를 쌓는 사람",
  creative: "새로운 관점으로 해결책을 만드는 사람",
} as const;

export function fallbackTitleTags(keywords: string[], tone: keyof typeof defaultTitles): TitleTags {
  const tags: string[] = [];
  for (const word of [...keywords, "문제 해결", "협업", "꾸준한 실행"]) {
    const tag = word.replace(/\s+/g, " ").trim().slice(0, 15).trimEnd();
    const key = tag.normalize("NFKC").toLowerCase().replace(/\s+/g, "");
    if (tag.length >= 2 && !tags.some(item => item.normalize("NFKC").toLowerCase().replace(/\s+/g, "") === key)) tags.push(tag);
    if (tags.length === 3) break;
  }
  return { professionalTitle: defaultTitles[tone], coreCompetencies: tags };
}
