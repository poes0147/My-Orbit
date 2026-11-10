import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire, Module } from "node:module";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { NextRequest, NextResponse } from "next/server.js";
import ts from "typescript";

// Exercise the real route guard with isolated auth/DB responses. No hosted users.
function loadProxy(role, { signedIn = true, roleError = false } = {}) {
  const filename = fileURLToPath(new URL("../src/proxy.ts", import.meta.url));
  const localRequire = createRequire(filename);
  const proxyModule = new Module(filename);
  proxyModule.filename = filename;
  proxyModule.require = name => {
    if (name === "@/lib/supabase/request-client") return { createRequestClient: () => ({
      respond: response => response ?? NextResponse.next(),
      supabase: {
        auth: { getUser: async () => ({ data: { user: signedIn ? { id: "fixture-user", user_metadata: { role: "admin" } } : null }, error: null }) },
        from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: role ? { role } : null, error: roleError ? new Error("test failure") : null }) }) }) }),
      },
    }) };
    if (name === "@/modules/public-profile/get-public-profile") return { hasPublicProfile: async () => false };
    return localRequire(name);
  };
  proxyModule._compile(ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText, filename);
  return proxyModule.exports.proxy;
}

const routes = ["/admin", "/admin/workshops", "/admin/clay-materials", "/admin/sessions"];
test("anonymous admin routes preserve the intended destination at login", async () => {
  for (const path of routes) {
    const response = await loadProxy(null, { signedIn: false })(new NextRequest(`http://localhost:3000${path}`));
    assert.equal(response.status, 307);
    const destination = new URL(response.headers.get("location"));
    assert.equal(destination.pathname, "/login");
    assert.equal(destination.searchParams.get("next"), path);
  }
});
test("participants and instructors cannot enter admin routes even with forged admin metadata", async () => {
  for (const role of ["participant", "instructor", null]) {
    for (const path of routes) {
      assert.equal((await loadProxy(role)(new NextRequest(`http://localhost:3000${path}`))).status, 403);
    }
  }
});
test("verified admin enters without a workshop membership; role lookup failure fails closed", async () => {
  for (const path of routes) {
    assert.equal((await loadProxy("admin")(new NextRequest(`http://localhost:3000${path}`))).headers.get("x-middleware-next"), "1");
    assert.equal((await loadProxy("admin", { roleError: true })(new NextRequest(`http://localhost:3000${path}`))).status, 403);
  }
});
