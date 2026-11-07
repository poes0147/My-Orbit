import assert from "node:assert/strict";
import { test } from "node:test";
import { profileTheme, themeOptions, themePresetSchema } from "../src/modules/public-profile/theme.ts";

function luminance(hex) {
  const linear = hex.slice(1).match(/../g).map(pair => {
    const channel = Number.parseInt(pair, 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

test("accepts exactly the three presets and safely resolves legacy data", () => {
  assert.equal(themeOptions.length, 3);
  for (const id of themeOptions) assert.equal(themePresetSchema.parse(id), id);
  assert.equal(themePresetSchema.safeParse("orbit-neon").success, false);
  for (const unknown of [null, "", "__proto__", "orbit-neon", "default"]) {
    assert.equal(profileTheme(unknown).id, "orbit-classic");
  }
  assert.equal(profileTheme("accent").id, "orbit-warmth");
});

test("text, badge and action colors have at least 4.5:1 contrast", () => {
  for (const id of themeOptions) {
    const { tokens } = profileTheme(id);
    for (const [foreground, background] of [
      [tokens.text, tokens.background], [tokens.text, tokens.surface],
      [tokens.secondaryText, tokens.surface], [tokens.secondaryText, tokens.background],
      [tokens.text, tokens.accent], ["#ffffff", tokens.primary],
    ]) {
      const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
      assert.ok((values[0] + 0.05) / (values[1] + 0.05) >= 4.5, id + " contrast");
    }
  }
});
