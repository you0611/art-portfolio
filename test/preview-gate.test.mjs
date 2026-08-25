import assert from "node:assert/strict";
import test from "node:test";

import { onRequest as onPreviewGate } from "../functions/_middleware.js";
import { onRequest as onAdminMiddleware } from "../functions/api/admin/_middleware.js";

function context(request, env = {}) {
  const data = {};
  return {
    request,
    env,
    data,
    next: async () => Response.json({ ok: true, authenticated: data.previewGateAuthenticated === true }),
  };
}

test("preview gate is inert unless explicitly enabled", async () => {
  const response = await onPreviewGate(context(new Request("https://preview.example.test/")));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, authenticated: false });
});

test("enabled preview gate fails closed when its password secret is absent", async () => {
  const response = await onPreviewGate(context(
    new Request("https://preview.example.test/"),
    { PREVIEW_GATE_ENABLED: "true" },
  ));
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("preview gate rejects unauthenticated pages and APIs without leaking the password", async () => {
  const env = { PREVIEW_GATE_ENABLED: "true", PREVIEW_GATE_PASSWORD: "fixture-secret" };
  const pageResponse = await onPreviewGate(context(new Request("https://preview.example.test/gallery.html"), env));
  assert.equal(pageResponse.status, 401);
  assert.equal(pageResponse.headers.get("x-robots-tag"), "noindex, nofollow, noarchive");
  const page = await pageResponse.text();
  assert.match(page, /测试预览/);
  assert.doesNotMatch(page, /fixture-secret/);

  const apiResponse = await onPreviewGate(context(new Request("https://preview.example.test/api/artworks"), env));
  assert.equal(apiResponse.status, 401);
  assert.equal((await apiResponse.json()).error.code, "PREVIEW_AUTH_REQUIRED");
});

test("correct password creates a secure session cookie that unlocks the request", async () => {
  const env = { PREVIEW_GATE_ENABLED: "true", PREVIEW_GATE_PASSWORD: "fixture-secret" };
  const form = new URLSearchParams({ password: "fixture-secret", next: "/gallery.html?lang=zh" });
  const loginResponse = await onPreviewGate(context(new Request("https://preview.example.test/__preview-gate", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form,
  }), env));

  assert.equal(loginResponse.status, 303);
  assert.equal(loginResponse.headers.get("location"), "/gallery.html?lang=zh");
  const setCookie = loginResponse.headers.get("set-cookie");
  assert.match(setCookie, /^__Host-yx_preview_gate=/);
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /Secure/);
  assert.match(setCookie, /SameSite=Strict/);

  const cookie = setCookie.split(";", 1)[0];
  const unlocked = await onPreviewGate(context(new Request("https://preview.example.test/api/artworks", {
    headers: { accept: "application/json", cookie },
  }), env));
  assert.equal(unlocked.status, 200);
  assert.deepEqual(await unlocked.json(), { ok: true, authenticated: true });
});

test("wrong password and external redirect targets are rejected safely", async () => {
  const env = { PREVIEW_GATE_ENABLED: "true", PREVIEW_GATE_PASSWORD: "fixture-secret" };
  const form = new URLSearchParams({ password: "wrong", next: "//attacker.example/" });
  const response = await onPreviewGate(context(new Request("https://preview.example.test/__preview-gate", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form,
  }), env));
  assert.equal(response.status, 401);
  const page = await response.text();
  assert.match(page, /密码不正确/);
  assert.match(page, /name="next" value="\/"/);
});

test("robots.txt remains public and preview-gate sessions can authorize the admin middleware", async () => {
  const env = {
    PREVIEW_GATE_ENABLED: "true",
    PREVIEW_GATE_PASSWORD: "fixture-secret",
    ADMIN_EMAIL: "Owner@Example.Test",
  };
  const robots = await onPreviewGate(context(new Request("https://preview.example.test/robots.txt"), env));
  assert.equal(robots.status, 200);

  const data = { previewGateAuthenticated: true };
  const admin = await onAdminMiddleware({
    request: new Request("https://preview.example.test/api/admin/session"),
    env,
    data,
    next: async () => Response.json(data.admin),
  });
  assert.equal(admin.status, 200);
  assert.deepEqual(await admin.json(), { email: "owner@example.test", subject: "preview-gate" });
});
