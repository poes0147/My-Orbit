import type { CSSProperties } from "react";
import { z } from "zod";

export const themePresetSchema = z.enum(["orbit-classic", "orbit-warmth", "orbit-vivid"]);
export type ThemePresetId = z.infer<typeof themePresetSchema>;

type ThemeTokens = {
  background: string;
  surface: string;
  text: string;
  secondaryText: string;
  primary: string;
  accent: string;
  border: string;
  font: string;
};

const themes = {
  "orbit-classic": {
    name: "Classic", description: "차분한 네이비와 슬레이트 블루", fontLabel: "모던 산세리프",
    tokens: { background: "#edf2f7", surface: "#ffffff", text: "#15283c", secondaryText: "#405770", primary: "#23486d", accent: "#dce8f4", border: "#aabdd1", font: "system-ui, sans-serif" },
  },
  "orbit-warmth": {
    name: "Warmth", description: "따뜻한 테라코타와 샌드 베이지", fontLabel: "부드러운 산세리프",
    tokens: { background: "#f8eee3", surface: "#fffaf4", text: "#3b241d", secondaryText: "#67493b", primary: "#8d3b2a", accent: "#f6ded0", border: "#cfad9b", font: "Verdana, 'Malgun Gothic', sans-serif" },
  },
  "orbit-vivid": {
    name: "Vivid", description: "또렷한 인디고와 바이올렛", fontLabel: "선명한 산세리프",
    tokens: { background: "#eeecfb", surface: "#fcfbff", text: "#252049", secondaryText: "#51436f", primary: "#453080", accent: "#e7defc", border: "#bfb0dd", font: "'Trebuchet MS', 'Malgun Gothic', sans-serif" },
  },
} satisfies Record<ThemePresetId, { name: string; description: string; fontLabel: string; tokens: ThemeTokens }>;

export const themeOptions = themePresetSchema.options;
export const profileActionClass = "inline-flex min-h-11 items-center rounded-xl bg-[var(--profile-primary)] px-4 text-sm font-semibold text-white";

export function profileTheme(preset: string | null | undefined) {
  const parsed = themePresetSchema.safeParse(preset);
  const id = parsed.success ? parsed.data
    : preset === "accent" || preset === "theme_warm_clay" ? "orbit-warmth" : "orbit-classic";
  const { tokens } = themes[id];
  const style = {
    "--profile-bg": tokens.background,
    "--profile-surface": tokens.surface,
    "--profile-text": tokens.text,
    "--profile-muted": tokens.secondaryText,
    "--profile-primary": tokens.primary,
    "--profile-accent": tokens.accent,
    "--profile-border": tokens.border,
    "--profile-font": tokens.font,
  } as CSSProperties;
  return { id, ...themes[id], style };
}
