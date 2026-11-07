import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readClayCatalog } from "@/lib/builder/clay-catalog";
import { createRequestClient } from "@/lib/supabase/request-client";

const name = z.string().trim().min(1).max(50);
const hex = z.string().trim().regex(/^#[0-9a-f]{6}$/i).transform(value => value.toUpperCase());
const common = { description: z.string().trim().max(300), is_active: z.boolean() };
const material = z.object({
  ...common, name, color_code: hex, type: z.enum(["base", "premixed"]),
  code: z.string().trim().max(50).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  display_order: z.number().int().nonnegative(),
}).strict();
const recipe = z.object({
  ...common, result_name: name, result_color_code: hex,
  items: z.array(z.object({ material_id: z.uuid(), parts: z.number().int().min(1).max(100) }).strict()).min(2).max(20),
}).strict();

type Params = { params: Promise<{ segments?: string[] }> };

async function handle(request: NextRequest, { params }: Params) {
  const { supabase, respond } = createRequestClient(request);
  const json = (body: unknown, status = 200) => respond(NextResponse.json(body, { status }));
  const fail = (message: string, status: number) => json({ message }, status);
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return fail("로그인이 필요해요.", 401);
  const { data: actor, error: roleError } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();
  if (roleError) return fail("관리자 권한을 확인하지 못했어요.", 503);
  if (actor?.role !== "admin") return fail("관리자 권한이 필요해요.", 403);
  const { segments = [] } = await params;
  if (request.method === "GET") {
    if (segments.length) return fail("주소를 확인해 주세요.", 404);
    try { return json(await readClayCatalog(supabase, false)); }
    catch { return fail("재료 목록을 불러오지 못했어요.", 503); }
  }
  if (request.headers.get("origin") !== request.nextUrl.origin) return fail("요청 출처를 확인할 수 없어요.", 403);
  const [kind, id] = segments;
  const creating = request.method === "POST";
  if (!["materials", "recipes"].includes(kind) || segments.length !== (creating ? 1 : 2) || (!creating && !z.uuid().safeParse(id).success)) {
    return fail("주소를 확인해 주세요.", 404);
  }
  const body: unknown = await request.json().catch(() => null);
  if (kind === "materials") {
    const result = (creating ? material : material.partial()).safeParse(body);
    if (!result.success || !Object.keys(result.data).length) return fail("색상 이름, 코드, HEX 값을 확인해 주세요.", 400);
    const query = creating ? supabase.from("clay_materials").insert(result.data) : supabase.from("clay_materials").update(result.data).eq("id", id);
    const { data, error } = await query.select("id").maybeSingle();
    if (error?.message === "MATERIAL_IN_USE") return fail("이 기본색을 쓰는 레시피가 있어요. 레시피를 먼저 확인해 주세요.", 409);
    if (error?.code === "23505") return fail("같은 이름이나 코드가 이미 있어요.", 409);
    if (error) return fail("재료를 저장하지 못했어요.", 503);
    return data ? json(data, creating ? 201 : 200) : fail("재료를 찾을 수 없어요.", 404);
  }

  const result = recipe.safeParse(body);
  if (!result.success || new Set(result.data.items.map(item => item.material_id)).size !== result.data.items.length) {
    return fail("서로 다른 기본색을 두 가지 이상 선택하고 정수 배합 비율을 입력해 주세요.", 400);
  }
  const { items, ...fields } = result.data;
  const { data, error } = await supabase.rpc("save_clay_recipe", { p_id: id ?? null, p_recipe: fields, p_items: items });
  if (error?.code === "P0002") return fail("레시피를 찾을 수 없어요.", 404);
  if (error?.code === "22023") return fail("레시피에 사용할 수 있는 기본색을 선택해 주세요.", 400);
  if (error?.code === "23505") return fail("같은 이름의 레시피가 있어요.", 409);
  return error ? fail("레시피를 저장하지 못했어요.", 503) : json({ id: data }, creating ? 201 : 200);
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
