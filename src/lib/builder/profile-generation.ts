import { z } from "zod";
import { projectCardSchema } from "./project-card";
import { recommendedClaySchema } from "./clay-recommendation";

export const interviewRequestSchema = z.object({
  projectCard: projectCardSchema.optional(),
  workshopSessionId: z.string().uuid().nullable(),
  stepData: z.object({
    keywords: z.array(z.string().trim().min(1).max(40)).min(1).max(5),
    project: z.object({
      title: z.string().trim().min(1).max(120),
      role: z.string().trim().min(1).max(500),
      problem: z.string().trim().min(1).max(500),
      action: z.string().trim().min(20).max(500),
      outcome: z.string().trim().min(10).max(500),
    }),
    persona: z.object({
      coreValues: z.array(z.string().trim().min(1).max(40)).min(1).max(3),
      tone: z.enum(["professional", "challenging", "authentic", "creative"]),
    }),
  }),
});

export type InterviewRequest = z.infer<typeof interviewRequestSchema>;

export const defaultShapingSteps = [
  "점토를 둥글게 빚어 행성의 몸체를 만들어요.",
  "가이드의 형태를 참고해 띠나 표면 무늬를 배치해요.",
  "오브제 제작 체크리스트를 확인하고 모서리와 표면을 다듬어요.",
];

export const profileGenerationSchema = z.object({
  headline: z.string().trim().min(1).max(60),
  competency_tags: z.array(z.string().trim().min(1).max(20)).length(3),
  project_card: projectCardSchema.optional(),
  project_summary: z.string().trim().min(1).max(300),
  object_guide: z.object({
    primary_color: z.string().trim().min(1).max(80),
    secondary_color: z.string().trim().min(1).max(80),
    color_ratio: z.string().trim().min(1).max(20),
    shape_metaphor: z.string().trim().min(1).max(300),
    shape_name: z.string().trim().min(1).max(60).optional().catch(undefined),
    shaping_steps: z.array(z.string().trim().min(1).max(120)).length(3).optional().catch(undefined),
    colors: z.array(recommendedClaySchema).optional().catch([]),
  }),
});

export type GeneratedProfile = z.infer<typeof profileGenerationSchema>;

// OpenAI Structured Outputs requires every declared field and disallows
// undeclared object properties. Length limits are also checked by Zod after
// receiving the model response.
export const profileGenerationJsonSchema = {
  type: "object",
  properties: {
    headline: { type: "string", description: "한국어 전문 타이틀, 60자 이하" },
    competency_tags: {
      type: "array",
      items: { type: "string", description: "한국어 역량 키워드, 20자 이하" },
      minItems: 3,
      maxItems: 3,
    },
    project_summary: { type: "string", description: "STAR 방식 한국어 프로젝트 요약, 300자 이하" },
    object_guide: {
      type: "object",
      properties: {
        primary_color: { type: "string" },
        secondary_color: { type: "string" },
        color_ratio: { type: "string" },
        shape_metaphor: { type: "string" },
        shape_name: { type: "string", description: "추천 행성의 형태 이름, 60자 이하" },
        shaping_steps: { type: "array", items: { type: "string", description: "초보자가 할 수 있는 성형 행동, 120자 이하" }, minItems: 3, maxItems: 3 },
      },
      required: ["primary_color", "secondary_color", "color_ratio", "shape_metaphor", "shape_name", "shaping_steps"],
      additionalProperties: false,
    },
  },
  required: ["headline", "competency_tags", "project_summary", "object_guide"],
  additionalProperties: false,
} as const;

const toneDescriptions = {
  professional: "차분하고 전문적인",
  challenging: "도전적이고 자신 있는",
  authentic: "진솔하고 신뢰감 있는",
  creative: "창의적이고 위트 있는",
} as const;

export function createFallbackProfile(input: InterviewRequest): GeneratedProfile {
  const project = input.stepData.project;
  const keywordPool = [...input.stepData.keywords, ...input.stepData.persona.coreValues, project.role]
    .map((value) => value.trim().slice(0, 20))
    .filter(Boolean);
  const tags = [...new Set(keywordPool)].slice(0, 3);
  while (tags.length < 3) tags.push(["꾸준한 실행", "협업", "문제 해결"][tags.length]);

  const headline = `${project.role}로 ${project.title}을 만들어가는 사람`.slice(0, 60);
  const summary = `${project.problem} 문제를 해결하기 위해 ${project.role}로서 ${project.action}을 실천했습니다. 그 결과 ${project.outcome}`.slice(0, 300);
  const colors = {
    professional: ["차분한 네이비", "은은한 아이보리"],
    challenging: ["선명한 코랄", "깊은 차콜"],
    authentic: ["따뜻한 올리브", "부드러운 크림"],
    creative: ["밝은 오렌지", "맑은 하늘색"],
  } as const;
  const [primary, secondary] = colors[input.stepData.persona.tone];

  return profileGenerationSchema.parse({
    headline,
    competency_tags: tags,
    project_summary: summary,
    object_guide: {
      primary_color: primary,
      secondary_color: secondary,
      color_ratio: "70:30",
      shape_metaphor: `${toneDescriptions[input.stepData.persona.tone]} 분위기를 담은 별 모티프. 핵심 경험을 돋보이게 하는 단순한 형태로 만들어 보세요.`,
      shape_name: "나의 궤도 행성",
      shaping_steps: defaultShapingSteps,
    },
  });
}

export function buildProfilePrompt(input: InterviewRequest) {
  return [
    "청년 구직자 또는 예비 창업자의 입력을 바탕으로 사실에 충실한 한국어 프로필 초안을 작성하세요.",
    "사용자가 말하지 않은 수치, 성과, 경험을 만들어내지 말고, 정보가 부족하면 입력 범위에서 간결하게 표현하세요.",
    "출력은 반드시 지정된 JSON Schema에 맞는 JSON 하나여야 합니다.",
    `소개 톤: ${toneDescriptions[input.stepData.persona.tone]}`,
    `핵심 가치: ${input.stepData.persona.coreValues.join(", ")}`,
    `경험/프로젝트: ${input.stepData.project.title}`,
    `키워드: ${input.stepData.keywords.join(", ")}`,
    `역할: ${input.stepData.project.role}`,
    `상황/문제: ${input.stepData.project.problem}`,
    `행동: ${input.stepData.project.action}`,
    `결과/배움: ${input.stepData.project.outcome}`,
    "역량 키워드는 입력에 드러난 강점을 세 개로 정리하세요. 조형 가이드에는 경험을 상징하는 행성 형태 이름, 그 의미, 색 배합비, 초보자가 실행할 성형 순서 3단계를 짧게 작성하세요. 하드웨어 조립이나 가열 방법은 제안하지 마세요.",
  ].join("\n");
}

export type PartialGeneratedProfile = Omit<Partial<GeneratedProfile>, "object_guide"> & {
  object_guide?: Partial<GeneratedProfile["object_guide"]>;
};

export function readPartialProfile(raw: string): PartialGeneratedProfile {
  const readString = (key: string) => {
    const match = raw.match(new RegExp(`\"${key}\"\\s*:\\s*(\"(?:\\\\.|[^\"\\\\])*\")`));
    if (!match) return undefined;
    try {
      const value: unknown = JSON.parse(match[1]);
      return typeof value === "string" ? value : undefined;
    } catch {
      return undefined;
    }
  };
  const objectGuide: Partial<GeneratedProfile["object_guide"]> = {};
  for (const key of ["primary_color", "secondary_color", "color_ratio", "shape_metaphor", "shape_name"] as const) {
    const value = readString(key);
    if (value !== undefined) objectGuide[key] = value;
  }
  const tagBlock = raw.match(/"competency_tags"\s*:\s*\[([\s\S]*?)(?:\]|$)/)?.[1];
  const tags = tagBlock?.match(/"(?:\\.|[^"\\])*"/g)?.flatMap((item) => {
    try {
      const value: unknown = JSON.parse(item);
      return typeof value === "string" ? [value] : [];
    } catch {
      return [];
    }
  });
  const profile: PartialGeneratedProfile = {};
  const headline = readString("headline");
  const projectSummary = readString("project_summary");
  if (headline !== undefined) profile.headline = headline;
  if (tags?.length) profile.competency_tags = tags;
  if (projectSummary !== undefined) profile.project_summary = projectSummary;
  if (Object.keys(objectGuide).length) profile.object_guide = objectGuide;
  return profile;
}
