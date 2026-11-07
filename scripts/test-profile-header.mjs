import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const extensions = [".ts", ".tsx"];
const previousLoaders = extensions.map(extension => require.extensions[extension]);
const loadComponent = (module, filename) => {
  const { outputText } = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    fileName: filename,
  });
  module._compile(outputText, filename);
};
for (const extension of extensions) require.extensions[extension] = loadComponent;
let ProfileHeaderCard;
try {
  ProfileHeaderCard = require("../src/modules/public-profile/profile-header-card.tsx").default;
} finally {
  extensions.forEach((extension, index) => {
    const previousLoader = previousLoaders[index];
    if (previousLoader) require.extensions[extension] = previousLoader;
    else delete require.extensions[extension];
  });
}

const profile = {
  fullName: "검증 사용자",
  avatarUrl: null,
  professionalTitle: "협업으로 전시를 이끄는 운영 담당자",
  competencyTags: ["전시 운영", "동선 설계", "팀 조율", "표시 제외"],
  bioSummary: "첫 줄\n둘째 줄",
};

test("renders a readable header, initials, and only the first three tags", () => {
  const html = renderToStaticMarkup(createElement(ProfileHeaderCard, profile));
  assert.match(html, /<h1[^>]*>검증 사용자<\/h1>/);
  assert.match(html, /<h2[^>]*>협업으로 전시를 이끄는 운영 담당자<\/h2>/);
  assert.match(html, /data-profile-avatar-fallback="true">검증<\/span>/);
  assert.match(html, /첫 줄\n둘째 줄/);
  assert.equal((html.match(/<li /g) ?? []).length, 3);
  assert.doesNotMatch(html, /표시 제외/);
});

test("maps all three specified themes onto the card and badges", () => {
  for (const [themePresetId, accent] of [
    ["orbit-classic", "#dce8f4"],
    ["orbit-warmth", "#f6ded0"],
    ["orbit-vivid", "#e7defc"],
  ]) {
    const html = renderToStaticMarkup(createElement(ProfileHeaderCard, { ...profile, themePresetId }));
    assert.ok(html.includes("--profile-accent:" + accent));
    assert.match(html, /<li[^>]+--profile-accent/);
  }
});
