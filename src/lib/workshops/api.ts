import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createRequestClient } from "@/lib/supabase/request-client";

type WorkshopRpcResult = {
  success?: boolean;
  data?: unknown;
  error?: { code?: string; message?: string };
};

const statusByCode: Record<string, number> = {
  AUTH_REQUIRED: 401,
  INVALID_SESSION_CODE: 400,
  SESSION_NOT_FOUND: 404,
  SESSION_EXPIRED: 403,
  SESSION_NOT_STARTED: 403,
  SESSION_FULL: 409,
  PROFILE_NOT_FOUND: 409,
  RATE_LIMITED: 429,
};

export async function handleWorkshopCode(request: NextRequest, action: "verify" | "join") {
  try {
    if (request.headers.get("origin") !== request.nextUrl.origin) {
      return NextResponse.json({
        success: false,
        error: { code: "INVALID_ORIGIN", message: "요청을 확인할 수 없습니다. 페이지를 새로고침해 주세요." },
      }, { status: 403, headers: { "Cache-Control": "private, no-store" } });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({
        success: false,
        error: { code: "INVALID_REQUEST", message: "요청 형식을 확인해 주세요." },
      }, { status: 400, headers: { "Cache-Control": "private, no-store" } });
    }
    const sessionCode = typeof body === "object" && body !== null && "sessionCode" in body
      ? (body as { sessionCode?: unknown }).sessionCode
      : undefined;

    if (typeof sessionCode !== "string" || !/^[A-Za-z0-9]{6}$/.test(sessionCode)) {
      return NextResponse.json({
        success: false,
        error: { code: "INVALID_SESSION_CODE", message: "영문 대소문자와 숫자로 된 6자리 코드를 입력해 주세요." },
      }, { status: 400, headers: { "Cache-Control": "private, no-store" } });
    }

    const { supabase, respond } = createRequestClient(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return respond(NextResponse.json({
        success: false,
        error: { code: "AUTH_REQUIRED", message: "로그인이 필요합니다." },
      }, { status: 401 }));
    }

    const { data, error } = await supabase.rpc(
      action === "verify" ? "verify_workshop_code" : "join_workshop_session",
      { p_code: sessionCode.toUpperCase() },
    );

    if (error) {
      return respond(NextResponse.json({
        success: false,
        error: { code: "WORKSHOP_SERVICE_UNAVAILABLE", message: "코드를 확인하지 못했어요. 잠시 후 다시 시도해 주세요." },
      }, { status: 503 }));
    }

    const result = data as WorkshopRpcResult;
    if (result?.success) return respond(NextResponse.json(result, { status: 200 }));

    const code = result?.error?.code ?? "WORKSHOP_REQUEST_FAILED";
    const message = result?.error?.message ?? "요청을 처리하지 못했어요. 다시 시도해 주세요.";
    return respond(NextResponse.json({ success: false, error: { code, message } }, {
      status: statusByCode[code] ?? 400,
    }));
  } catch {
    return NextResponse.json({
      success: false,
      error: { code: "WORKSHOP_SERVICE_UNAVAILABLE", message: "요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요." },
    }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
}
