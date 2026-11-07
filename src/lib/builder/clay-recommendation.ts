import { z } from "zod";

export type AvailableClay = { id: string; kind: "material" | "recipe"; name: string; hex: string; mix?: string };
export const clayRoles = ["primary", "secondary", "accent"] as const;
const pick = z.object({
  id: z.uuid(),
  role: z.enum(clayRoles),
  usage_ratio: z.number().int().min(1).max(100),
  placement: z.string().trim().min(1).max(120),
  recommendation_reason: z.string().trim().min(1).max(180),
});

export const recommendedClaySchema = pick.extend({
  kind: z.enum(["material", "recipe"]),
  name: z.string().min(1).max(50),
  hex: z.string().regex(/^#[0-9A-F]{6}$/),
  mix: z.string().min(1).optional(),
});

export function resolveClayColors(value: unknown, catalog: AvailableClay[]) {
  const available = new Map(catalog.map(color => [color.id, color]));
  const selected = z.array(pick).safeParse(value);
  if (selected.success && selected.data.length &&
    new Set(selected.data.map(color => color.id)).size === selected.data.length &&
    selected.data.every(color => available.has(color.id)) &&
    selected.data.reduce((sum, color) => sum + color.usage_ratio, 0) === 100) {
    return selected.data.map(color => ({ ...color, ...available.get(color.id)! }));
  }
  const suggested = catalog.slice(0, 2);
  return suggested.map((color, index) => ({
    ...color,
    role: clayRoles[index],
    usage_ratio: suggested.length === 1 ? 100 : index === 0 ? 70 : 30,
    placement: index === 0 ? "행성 바탕" : "띠나 표면 무늬",
    recommendation_reason: "사용 가능한 재료로 제안한 기본 배치예요.",
  }));
}
