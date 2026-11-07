import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { readAvailableClay } from "@/lib/builder/clay-catalog";
import { clayRoles, resolveClayColors, type AvailableClay } from "@/lib/builder/clay-recommendation";
import { createRequestClient } from "@/lib/supabase/request-client";
import { getProfileAiConfig } from "@/lib/builder/openai-config";
import { fallbackTitleTags, titleTagsSchema } from "@/lib/builder/title-tags";
import {
  buildProfilePrompt,
  createFallbackProfile,
  interviewRequestSchema,
  profileGenerationJsonSchema,
  profileGenerationSchema,
  type GeneratedProfile,
  type InterviewRequest,
} from "@/lib/builder/profile-generation";

export const maxDuration = 30;

const encoder = new TextEncoder();
const rateWindowMs = 60_000;
const requestLimit = 5;
const rateHistory = new Map<string, number[]>();

function isRateLimited(userId: string, now = Date.now()) {
  const recent = (rateHistory.get(userId) ?? []).filter((time) => now - time < rateWindowMs);
  if (recent.length >= requestLimit) {
    rateHistory.set(userId, recent);
    return true;
  }
  recent.push(now);
  rateHistory.set(userId, recent);
  if (rateHistory.size > 10_000) {
    for (const [key, values] of rateHistory) {
      if (values.every((time) => now - time >= rateWindowMs)) rateHistory.delete(key);
    }
  }
  return false;
}

function sse(event: string, data: unknown) {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

type ProviderResult = { profile: GeneratedProfile; fallbackReason?: string; selections?: unknown };

function attachClayColors(profile: GeneratedProfile, selections: unknown, catalog: AvailableClay[]) {
  const colors = resolveClayColors(selections, catalog);
  profile.object_guide = {
    ...profile.object_guide,
    colors,
    primary_color: colors[0]?.name ?? "등록 재료 없음",
    secondary_color: colors[1]?.name ?? "선택 없음",
    color_ratio: colors.length === 2 ? colors.map(color => color.usage_ratio).join(":") : "색상별 비율 참고",
  };
  return profile;
}

async function streamOpenAi(
  input: InterviewRequest,
  catalog: AvailableClay[],
  signal: AbortSignal,
  sendToken: (delta: string) => void,
): Promise<ProviderResult> {
  const { apiKey, model, reasoning } = getProfileAiConfig();
  if (!apiKey) return { profile: createFallbackProfile(input), fallbackReason: "PROVIDER_NOT_CONFIGURED" };
  const { shape_name, shape_metaphor, shaping_steps } = profileGenerationJsonSchema.properties.object_guide.properties;
  const outputSchema = {
    ...profileGenerationJsonSchema,
    properties: {
      ...profileGenerationJsonSchema.properties,
      object_guide: {
        type: "object", additionalProperties: false,
        required: ["shape_name", "shape_metaphor", "shaping_steps", "color_selections"],
        properties: {
          shape_name, shape_metaphor, shaping_steps,
          color_selections: {
            type: "array",
            items: {
              type: "object", additionalProperties: false,
              required: ["id", "role", "usage_ratio", "placement", "recommendation_reason"],
              properties: {
                id: { type: "string", ...(catalog.length ? { enum: catalog.map(color => color.id) } : {}) },
                role: { type: "string", enum: clayRoles },
                usage_ratio: { type: "integer", minimum: 1, maximum: 100 },
                placement: { type: "string" },
                recommendation_reason: { type: "string" },
              },
            },
          },
        },
      },
    },
  };

  let lastFailure = "LLM_UNAVAILABLE";
  let streamed = false;
  for (let attempt = 0; attempt < 3 && !signal.aborted; attempt++) {
    let raw = "";
    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          // Short profile extraction needs the output budget for visible JSON,
          // rather than reasoning tokens. Keep older model overrides compatible.
          ...(reasoning ? { reasoning } : {}),
          instructions: "Return only the requested structured profile. Never invent facts, metrics, credentials, or achievements.",
          input: `${buildProfilePrompt(input)}\n클레이 후보 목록: ${JSON.stringify(catalog.map(({ id, name, hex }) => ({ id, name, hex })))}\n색상은 목록의 ID만 사용하세요. 후보가 없으면 빈 배열, 후보가 여럿이면 이야기와 어울리는 여러 색을 기본으로 고르세요. 각 색이 쓰이는 위치, 역할, 비율, 경험과 연결된 이유를 적고 전체 사용 비율 합은 100으로 하세요. 혼합 레시피는 작성하지 마세요.`,
          max_output_tokens: 1600,
          stream: true,
          text: {
            format: {
              type: "json_schema",
              name: "profile_generation_schema",
              strict: true,
              schema: outputSchema,
            },
          },
        }),
        signal,
        cache: "no-store",
      });

      if (!response.ok) {
        lastFailure = response.status >= 500 ? "LLM_UNAVAILABLE" : "LLM_REQUEST_REJECTED";
        if (response.status >= 500 && attempt < 2) continue;
        break;
      }
      if (!response.body) throw new Error("LLM_STREAM_MISSING");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split(/\r?\n\r?\n/);
        buffer = blocks.pop() ?? "";
        for (const block of blocks) {
          const data = block.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart()).join("\n");
          if (!data || data === "[DONE]") continue;
          let event: unknown;
          try { event = JSON.parse(data); } catch { continue; }
          if (typeof event !== "object" || event === null || !("type" in event)) continue;
          if (event.type === "response.output_text.delta" && "delta" in event && typeof event.delta === "string") {
            raw += event.delta;
            streamed = true;
            sendToken(event.delta);
          }
          if (event.type === "error" || event.type === "response.failed") throw new Error("LLM_STREAM_FAILED");
        }
      }

      if (signal.aborted) throw new Error("LLM_TIMEOUT");
      const decoded = JSON.parse(raw);
      const guide = decoded?.object_guide;
      const parsed = profileGenerationSchema.safeParse({
        ...decoded,
        object_guide: { ...guide, primary_color: "목록에서 선택", secondary_color: "목록에서 선택", color_ratio: "색상별 비율 참고" },
      });
      if (parsed.success) {
        const identity = titleTagsSchema.safeParse({ professionalTitle: parsed.data.headline, coreCompetencies: parsed.data.competency_tags });
        if (!identity.success) {
          const fallback = fallbackTitleTags(input.stepData.keywords, input.stepData.persona.tone);
          parsed.data.headline = fallback.professionalTitle;
          parsed.data.competency_tags = fallback.coreCompetencies;
        }
        return { profile: parsed.data, selections: guide?.color_selections };
      }
      lastFailure = "LLM_INVALID_OUTPUT";
      break;
    } catch (error) {
      if (signal.aborted) {
        lastFailure = "LLM_TIMEOUT";
        break;
      }
      lastFailure = error instanceof Error && error.message === "LLM_INVALID_OUTPUT" ? "LLM_INVALID_OUTPUT" : "LLM_UNAVAILABLE";
      // Retry only when no content has reached the client; otherwise it would
      // concatenate two separate JSON documents in one visible stream.
      if (streamed || attempt === 2) break;
    }
  }

  return { profile: createFallbackProfile(input), fallbackReason: lastFailure };
}

export async function POST(request: NextRequest) {
  const { supabase, respond } = createRequestClient(request);
  const reject = (code: string, message: string, status: number) => respond(NextResponse.json({ success: false, error: { code, message } }, { status }));

  if (request.headers.get("origin") !== request.nextUrl.origin) return reject("INVALID_ORIGIN", "요청 출처를 확인할 수 없습니다. 페이지를 새로고침해 주세요.", 403);
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) return reject("INVALID_CONTENT_TYPE", "요청 형식을 확인해 주세요.", 415);
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 16_000) return reject("REQUEST_TOO_LARGE", "입력 내용을 줄이고 다시 시도해 주세요.", 413);

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return reject("UNAUTHORIZED", "로그인이 필요합니다.", 401);
  if (isRateLimited(user.id)) return reject("RATE_LIMITED", "1분에 최대 5번까지 생성할 수 있어요. 잠시 후 다시 시도해 주세요.", 429);

  let rawBody: string;
  try { rawBody = await request.text(); } catch { return reject("INVALID_REQUEST", "요청 내용을 읽지 못했어요.", 400); }
  if (new TextEncoder().encode(rawBody).byteLength > 16_000) return reject("REQUEST_TOO_LARGE", "입력 내용을 줄이고 다시 시도해 주세요.", 413);
  let body: unknown;
  try { body = JSON.parse(rawBody); } catch { return reject("INVALID_JSON", "요청 내용을 확인해 주세요.", 400); }
  const parsedInput = interviewRequestSchema.safeParse(body);
  if (!parsedInput.success) return reject("INVALID_INPUT", "세 단계 답변을 확인한 뒤 다시 시도해 주세요.", 400);
  const input = parsedInput.data;

  if (input.workshopSessionId) {
    const { data: activeData, error } = await supabase.rpc("get_current_workshop_session");
    const active = typeof activeData === "object" && activeData !== null && "success" in activeData && activeData.success === true && "data" in activeData
      ? activeData.data
      : null;
    const activeSessionId = typeof active === "object" && active !== null && "sessionId" in active && typeof active.sessionId === "string"
      ? active.sessionId
      : null;
    if (error || activeSessionId !== input.workshopSessionId) return reject("WORKSHOP_ACCESS_DENIED", "현재 참여 중인 워크숍을 확인할 수 없어요. 코드를 다시 확인해 주세요.", 403);
  }
  const catalog = await readAvailableClay(supabase).catch(() => []);

  const abortController = new AbortController();
  let cancelled = false;
  let streamController: ReadableStreamDefaultController<Uint8Array> | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const onRequestAbort = () => {
    cancelled = true;
    abortController.abort();
  };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      streamController = controller;
      request.signal.addEventListener("abort", onRequestAbort, { once: true });
      timeout = setTimeout(() => abortController.abort(), 15_000);
      const send = (event: string, data: unknown) => {
        if (cancelled) return;
        try { controller.enqueue(sse(event, data)); } catch { cancelled = true; }
      };

      void (async () => {
        try {
          send("token", { type: "status", message: "내 이야기를 바탕으로 프로필 초안을 만들고 있어요." });
          const result = await streamOpenAi(input, catalog, abortController.signal, (delta) => {
            send("token", { type: "partial", delta });
          });
          if (timeout) clearTimeout(timeout);
          timeout = undefined;
          if (cancelled) return;
          const latestCatalog = await readAvailableClay(supabase).catch(() => []);
          attachClayColors(result.profile, result.selections, latestCatalog);
          if (input.projectCard) result.profile.project_card = input.projectCard;
          if (result.fallbackReason) {
            send("token", { type: "reset" });
            const fallbackJson = JSON.stringify(result.profile);
            for (let offset = 0; offset < fallbackJson.length; offset += 48) {
              send("token", { type: "partial", delta: fallbackJson.slice(offset, offset + 48) });
            }
          }

          if (cancelled) return;
          let saveFailed = false;
          try {
            const { error: saveError } = await supabase.from("ai_interview_sessions").insert({
              user_id: user.id,
              workshop_session_id: input.workshopSessionId,
              status: "completed",
              answers: {
                step_responses: input.stepData,
                generated_draft: result.profile,
                object_guide: result.profile.object_guide,
                generation_source: result.fallbackReason ? "fallback" : "openai",
              },
            });
            saveFailed = Boolean(saveError);
          } catch {
            saveFailed = true;
          }
          if (cancelled) return;
          if (saveFailed) {
            send("error", { type: "save_failed", message: "초안은 만들었지만 계정에 저장하지 못했어요. 잠시 후 다시 생성해 주세요.", payload: result.profile });
          } else if (result.fallbackReason) {
            send("error", { type: "fallback", reason: result.fallbackReason, payload: result.profile, saved: true });
          } else {
            send("done", { type: "complete", payload: result.profile, saved: true });
          }
          streamController?.close();
        } catch {
          if (cancelled) return;
          const reason = abortController.signal.aborted ? "LLM_TIMEOUT" : "GENERATION_FAILED";
          const fallbackProfile = attachClayColors(createFallbackProfile(input), undefined, await readAvailableClay(supabase).catch(() => []));
          if (input.projectCard) fallbackProfile.project_card = input.projectCard;
          let saveFailed = false;
          try {
            const { error: saveError } = await supabase.from("ai_interview_sessions").insert({
              user_id: user.id,
              workshop_session_id: input.workshopSessionId,
              status: "completed",
              answers: { step_responses: input.stepData, generated_draft: fallbackProfile, object_guide: fallbackProfile.object_guide, generation_source: "fallback" },
            });
            saveFailed = Boolean(saveError);
          } catch {
            saveFailed = true;
          }
          if (cancelled) return;
          send("token", { type: "reset" });
          const fallbackJson = JSON.stringify(fallbackProfile);
          for (let offset = 0; offset < fallbackJson.length; offset += 48) send("token", { type: "partial", delta: fallbackJson.slice(offset, offset + 48) });
          if (saveFailed) send("error", { type: "save_failed", message: "기본 초안을 만들었지만 계정에 저장하지 못했어요. 다시 시도해 주세요.", payload: fallbackProfile });
          else send("error", { type: "fallback", reason, payload: fallbackProfile, saved: true });
          streamController?.close();
        } finally {
          if (timeout) clearTimeout(timeout);
          request.signal.removeEventListener("abort", onRequestAbort);
        }
      })();
    },
    cancel() {
      cancelled = true;
      abortController.abort();
      if (timeout) clearTimeout(timeout);
      request.signal.removeEventListener("abort", onRequestAbort);
    },
  });

  const response = respond(new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  }));
  response.headers.set("Cache-Control", "no-cache, no-transform");
  return response;
}
