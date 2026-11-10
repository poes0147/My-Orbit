import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createRequestClient } from "@/lib/supabase/request-client";
import { projectCardInputSchema } from "@/lib/builder/project-card";
import { generateProjectCard } from "@/lib/builder/generate-project-card";

export async function POST(request: NextRequest) {
  const { supabase, respond } = createRequestClient(request);
  const json = (body: unknown, status = 200) => respond(NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } }));
  const fail = (message: string, status: number) => json({ success: false, message }, status);
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return fail("로그인이 필요해요.", 401);
  if (request.headers.get("origin") !== request.nextUrl.origin) return fail("요청 출처를 확인할 수 없어요.", 403);
  if (!request.headers.get("content-type")?.includes("application/json")) return fail("JSON 요청이 필요해요.", 415);
  if (Number(request.headers.get("content-length") ?? 0) > 12000) return fail("입력 내용이 너무 길어요.", 413);
  let input: unknown;
  try {
    const body = await request.text();
    if (body.length > 12000) return fail("입력 내용이 너무 길어요.", 413);
    input = JSON.parse(body);
  } catch {
    return fail("입력 내용을 확인해 주세요.", 400);
  }
  const parsed = projectCardInputSchema.safeParse(input);
  if (!parsed.success) return fail("프로젝트명·역할·상황·행동·결과를 확인해 주세요.", 400);
  const data = parsed.data;
  if (data.profile_id) {
    const access = await supabase.rpc("profile_owner_status", { p_profile_id: data.profile_id });
    if (access.error) return fail("프로필 권한을 확인하지 못했어요.", 503);
    if (access.data !== "owner") return fail("이 프로필을 수정할 권한이 없어요.", 403);
  }
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const quota = await supabase.rpc("claim_project_card_attempt", { p_ip_hash: createHash("sha256").update(ip).digest("hex") });
  if (quota.error) return fail("프로젝트 카드 생성을 준비 중이에요.", 503);
  if (!quota.data) return fail("잠시 요청이 많아요. 개인별로 1분에 최대 5번 생성할 수 있으며, 같은 네트워크의 요청이 몰려도 잠시 제한될 수 있어요. 1분 후 다시 시도해 주세요.", 429);

  async function generate(onFirstToken: () => void) {
    const deadline = new AbortController();
    const timer = setTimeout(() => deadline.abort(), 2500);
    try {
      const result = await generateProjectCard(data, AbortSignal.any([request.signal, deadline.signal, AbortSignal.timeout(10000)]), () => {
        clearTimeout(timer);
        onFirstToken();
      });
      return { success: true, source: result.source, data: {
        title: data.project_name, role: data.role, ...result.lines, link_url: null,
      } };
    } finally {
      clearTimeout(timer);
    }
  }

  if (!request.headers.get("accept")?.includes("text/event-stream")) return json(await generate(() => {}));
  const encoder = new TextEncoder();
  return respond(new NextResponse(new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(": accepted\n\n"));
        const result = await generate(() => controller.enqueue(encoder.encode("event: progress\ndata: {}\n\n")));
        controller.enqueue(encoder.encode("event: done\ndata: " + JSON.stringify(result) + "\n\n"));
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  }), { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store" } }));
}
