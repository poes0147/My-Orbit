import assert from "node:assert/strict";

// Call verifyAdminUI(page) with a Playwright page while admin-ui-server.mjs is running.
export async function verifyAdminUI(page) {
  const origin = "http://127.0.0.1:3105";
  const requests = [];
  const sessions = [];
  const materials = [
    { id: "base-white", name: "흰색", code: "white", color_code: "#FFFFFF", type: "base", description: "", is_active: true, display_order: 0 },
    { id: "base-blue", name: "파랑", code: "blue", color_code: "#0000FF", type: "base", description: "", is_active: true, display_order: 1 },
  ];
  const recipes = [];
  let failCatalog = false;
  await page.route(`${origin}/api/**`, async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    const body = method === "GET" ? null : request.postDataJSON();
    requests.push({ path, method, body });
    let response;
    if (path === "/api/admin/workshops") {
      if (method === "GET") response = { success: true, sessions };
      else {
        const session = { id: "test-session", session_code: "ABC234", title: body.title, organization_name: body.organization, max_capacity: body.maxCapacity, status: "ACTIVE", expires_at: "2099-01-01T00:00:00Z" };
        sessions.unshift(session); response = { success: true, session };
      }
    } else if (path.endsWith("/status")) {
      sessions[0].status = body.status; response = { success: true, session: sessions[0] };
    } else if (path === "/api/admin/clay") {
      if (failCatalog) { await route.fulfill({ status: 503, json: { message: "fixture unavailable" } }); return; }
      response = { materials, recipes };
    } else if (path.includes("/clay/materials")) {
      if (method === "POST") materials.push({ ...body, id: "new-material" });
      else Object.assign(materials.find(m => path.endsWith(m.id)), body);
      response = { success: true };
    } else if (path.includes("/clay/recipes")) {
      const recipe = { ...body, id: "test-recipe", clay_recipe_items: body.items };
      if (method === "POST") recipes.push(recipe); else Object.assign(recipes[0], recipe);
      response = { success: true };
    } else throw new Error(`Unexpected fixture request: ${path}`);
    await route.fulfill({ json: response });
  });
  const overflow = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `overflow: ${page.url()}`);
  const results = [];
  for (const width of [1280, 375, 320]) {
    await page.setViewportSize({ width, height: 850 });
    await page.goto(`${origin}/admin`);
    await page.getByRole("heading", { name: "관리자 홈", exact: true }).waitFor();
    await overflow();
    if (width < 1024) {
      const trigger = page.getByRole("button", { name: "관리 메뉴", exact: true });
      await trigger.click();
      const dialog = page.getByRole("dialog", { name: "관리자 메뉴" });
      await dialog.waitFor();
      assert.equal(await trigger.getAttribute("aria-expanded"), "true");
      // The modal keeps keyboard focus inside and restores it on Escape.
      for (let i = 0; i < 8; i++) {
        await page.keyboard.press("Tab");
        assert.equal(await page.evaluate(() => !!document.activeElement?.closest("dialog")), true);
      }
      await page.keyboard.press("Escape");
      await dialog.waitFor({ state: "hidden" });
      assert.equal(await trigger.evaluate(el => el === document.activeElement), true);
      await trigger.click();
      await dialog.getByRole("link", { name: "워크숍 코드 관리", exact: true }).click();
      await page.getByRole("heading", { name: "워크숍 코드 관리", exact: true }).waitFor();
      assert.equal(await page.locator("dialog[open]").count(), 0);
      await trigger.click();
      assert.equal(await dialog.locator('[aria-current="page"]').innerText(), "워크숍 코드 관리");
      await dialog.getByRole("link", { name: "클레이 재료·배합 관리", exact: true }).click();
    } else {
      await page.getByRole("navigation", { name: "관리자 메뉴" }).getByRole("link", { name: "클레이 재료·배합 관리", exact: true }).click();
    }
    await page.getByRole("heading", { name: "클레이 재료 및 배합 레시피 관리" }).waitFor();
    await page.getByRole("button", { name: "흰색 수정", exact: true }).waitFor();
    await overflow();
    await page.getByRole("button", { name: "검증된 배합 레시피", exact: true }).click();
    await page.getByRole("button", { name: "새 배합 레시피 등록" }).click();
    await overflow();
    if (width === 320) await page.screenshot({ path: "test-artifacts/admin-mobile.png", fullPage: true });
    if (width === 1280) await page.screenshot({ path: "test-artifacts/admin-desktop.png", fullPage: true });
    results.push(`${width}px: menu/navigation/recipe-form/overflow passed`);
  }

  await page.setViewportSize({ width: 1280, height: 850 });
  await page.goto(`${origin}/admin/workshops`);
  await page.getByRole("heading", { name: "첫 워크숍을 열어보세요" }).waitFor();
  await page.getByRole("button", { name: "새 워크숍 만들기", exact: true }).click();
  await page.getByLabel("워크숍 이름", { exact: true }).fill("관리자 화면 검증");
  await page.getByLabel("기관명", { exact: true }).fill("테스트 기관");
  await page.getByRole("button", { name: "워크숍 만들기", exact: true }).click();
  await page.getByRole("cell", { name: "ABC234", exact: true }).waitFor();
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin });
  await page.getByRole("button", { name: "코드 복사", exact: true }).filter({ visible: true }).click();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), "ABC234");
  await page.getByRole("button", { name: "크게 보기", exact: true }).filter({ visible: true }).click();
  await page.getByRole("dialog").filter({ visible: true }).getByRole("button", { name: "닫기", exact: true }).click();
  await page.evaluate(() => { window.confirm = () => true; });
  await page.getByRole("button", { name: "종료", exact: true }).click();
  await page.getByText("참여를 종료했어요.", { exact: true }).waitFor();
  assert.equal(sessions[0].status, "COMPLETED");
  // The populated mobile session card must also fit.
  await page.setViewportSize({ width: 320, height: 850 });
  await overflow();
  await page.getByRole("button", { name: "새 워크숍 만들기", exact: true }).click();
  await overflow();
  await page.getByRole("button", { name: "취소", exact: true }).click();
  results.push("workshop empty/create/copy/presentation/end + mobile create modal passed (fixture API)");

  await page.goto(`${origin}/admin/clay-materials`);
  await page.getByRole("button", { name: "기본색 등록", exact: true }).click();
  await page.getByLabel("색상 이름", { exact: true }).fill("테스트 노랑");
  await page.getByLabel("재료 코드", { exact: false }).fill("test-yellow");
  await page.getByLabel("HEX 코드", { exact: true }).fill("#FFFF00");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await page.getByRole("button", { name: "테스트 노랑 수정", exact: true }).click();
  await page.getByLabel("추천에 사용", { exact: true }).uncheck();
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await page.getByText("#FFFF00 · 사용 중지", { exact: true }).waitFor();
  await page.getByRole("button", { name: "검증된 배합 레시피", exact: true }).click();
  await page.getByRole("button", { name: "새 배합 레시피 등록" }).click();
  await page.getByLabel("색상 이름", { exact: true }).fill("테스트 하늘색");
  await page.getByLabel("기본색 1", { exact: false }).selectOption("base-white");
  await page.getByLabel("기본색 2", { exact: false }).selectOption("base-blue");
  await page.getByLabel("조각 수", { exact: true }).first().fill("7");
  await page.getByLabel("조각 수", { exact: true }).nth(1).fill("3");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await page.getByText("흰색 7조각 + 파랑 3조각", { exact: true }).waitFor();
  await page.getByRole("button", { name: "테스트 하늘색 수정", exact: true }).click();
  await page.getByLabel("조각 수", { exact: true }).first().fill("8");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await page.getByText("흰색 8조각 + 파랑 3조각", { exact: true }).waitFor();
  failCatalog = true;
  await page.reload();
  await page.getByRole("alert").waitFor();
  failCatalog = false;
  await page.getByRole("button", { name: "다시 시도", exact: true }).click();
  await page.getByRole("button", { name: "흰색 수정", exact: true }).waitFor();
  results.push("clay create/edit/deactivate/recipe-ratios/error-retry passed (fixture API)");

  for (const role of ["admin", "participant", "instructor"]) {
    for (const width of [320, 1280]) {
      await page.setViewportSize({ width, height: 850 });
      await page.goto(`${origin}/dashboard?role=${role}`);
      await page.getByRole("heading", { name: "참여자 대시보드 테스트" }).waitFor();
      assert.equal(await page.getByRole("link", { name: "관리자 공간", exact: true }).filter({ visible: true }).count(), role === "admin" ? 1 : 0);
      await overflow();
    }
  }
  await page.goto(`${origin}/dashboard?role=admin`);
  await page.getByRole("link", { name: "관리자 공간", exact: true }).filter({ visible: true }).click();
  await page.getByRole("heading", { name: "관리자 홈", exact: true }).waitFor();
  await page.getByRole("link", { name: "참여자 화면으로 돌아가기", exact: true }).filter({ visible: true }).click();
  await page.getByRole("heading", { name: "참여자 대시보드 테스트" }).waitFor();
  results.push("role-specific participant navigation and round trip passed (fixture roles)");
  await page.unroute(`${origin}/api/**`);
  return { results, mutationCount: requests.filter(r => r.method !== "GET").length, hostedMutations: 0 };
}
