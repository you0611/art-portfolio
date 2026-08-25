const COOKIE_NAME = "__Host-yx_preview_gate";
const SESSION_SECONDS = 8 * 60 * 60;
const encoder = new TextEncoder();

export class PreviewGateConfigurationError extends Error {}

function isEnabled(env) {
  return String(env?.PREVIEW_GATE_ENABLED || "").trim().toLowerCase() === "true";
}

function getPassword(env) {
  const password = typeof env?.PREVIEW_GATE_PASSWORD === "string"
    ? env.PREVIEW_GATE_PASSWORD
    : "";
  if (!password) {
    throw new PreviewGateConfigurationError("PREVIEW_GATE_PASSWORD is required when the gate is enabled.");
  }
  return password;
}

function bytesEqual(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

function toBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function digest(value) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

async function passwordMatches(candidate, expected) {
  const [candidateDigest, expectedDigest] = await Promise.all([digest(candidate), digest(expected)]);
  return bytesEqual(candidateDigest, expectedDigest);
}

async function sign(payload, password) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(payload))));
}

function readCookie(request) {
  const header = request.headers.get("cookie") || "";
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === COOKIE_NAME) {
      return part.slice(separator + 1).trim();
    }
  }
  return "";
}

async function createSession(password, now = Date.now()) {
  const expiresAt = Math.floor(now / 1000) + SESSION_SECONDS;
  const payload = `v1.${expiresAt}`;
  return `${payload}.${await sign(payload, password)}`;
}

async function hasValidSession(request, password, now = Date.now()) {
  const token = readCookie(request);
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1" || !/^\d+$/.test(parts[1])) return false;

  const expiresAt = Number(parts[1]);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(now / 1000)) return false;

  const expected = await sign(`${parts[0]}.${parts[1]}`, password);
  return bytesEqual(encoder.encode(parts[2]), encoder.encode(expected));
}

function safeNext(value) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return "/";
  try {
    const parsed = new URL(value, "https://preview.invalid");
    if (parsed.origin !== "https://preview.invalid") return "/";
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return "/";
  }
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function gatePage(next, errorMessage = "") {
  const error = errorMessage ? `<p class="error" role="alert">${escapeHtml(errorMessage)}</p>` : "";
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow,noarchive">
  <title>游祥龙油画工作室 · 测试预览</title>
  <style>
    :root { color-scheme: light; font-family: "Noto Serif SC", "Songti SC", serif; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; color: #302820; background: #eee8dc; }
    main { width: min(100%, 420px); padding: 40px 34px; border: 1px solid #cfc3b1; border-radius: 4px; background: rgba(255,255,255,.72); box-shadow: 0 24px 70px rgba(70,54,36,.12); }
    p { margin: 0 0 10px; line-height: 1.7; color: #74685a; }
    h1 { margin: 0 0 12px; font-size: clamp(26px, 7vw, 34px); font-weight: 500; letter-spacing: .06em; }
    form { display: grid; gap: 14px; margin-top: 28px; }
    label { font-size: 14px; color: #554a3f; }
    input { width: 100%; min-height: 48px; padding: 11px 13px; border: 1px solid #b9aa95; border-radius: 3px; background: #fff; font: inherit; }
    input:focus { outline: 2px solid #8a6749; outline-offset: 2px; }
    button { min-height: 48px; border: 0; border-radius: 3px; color: #fff; background: #554437; font: inherit; cursor: pointer; }
    button:hover { background: #3f3128; }
    .eyebrow { font-size: 12px; letter-spacing: .18em; text-transform: uppercase; color: #907a61; }
    .error { margin: 18px 0 -8px; color: #9b352d; }
  </style>
</head>
<body>
  <main>
    <p class="eyebrow">Private Preview</p>
    <h1>测试预览</h1>
    <p>此版本尚未公开，请输入预览密码后继续。</p>
    ${error}
    <form method="post" action="/__preview-gate">
      <input type="hidden" name="next" value="${escapeHtml(next)}">
      <label for="preview-password">预览密码</label>
      <input id="preview-password" name="password" type="password" autocomplete="current-password" required autofocus>
      <button type="submit">进入预览</button>
    </form>
  </main>
</body>
</html>`;
}

function htmlResponse(next, errorMessage = "", status = 401) {
  return new Response(gatePage(next, errorMessage), {
    status,
    headers: {
      "cache-control": "no-store",
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
      "content-type": "text/html; charset=utf-8",
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
      "x-robots-tag": "noindex, nofollow, noarchive",
    },
  });
}

function configurationError() {
  return new Response("Preview access is temporarily unavailable.", {
    status: 503,
    headers: {
      "cache-control": "no-store",
      "content-type": "text/plain; charset=utf-8",
      "x-robots-tag": "noindex, nofollow, noarchive",
    },
  });
}

function wantsJson(request) {
  return new URL(request.url).pathname.startsWith("/api/")
    || (request.headers.get("accept") || "").includes("application/json");
}

export async function handlePreviewGate(context) {
  if (!isEnabled(context.env)) return context.next();

  const url = new URL(context.request.url);
  if (url.pathname === "/robots.txt") return context.next();

  let password;
  try {
    password = getPassword(context.env);
  } catch (error) {
    if (error instanceof PreviewGateConfigurationError) return configurationError();
    throw error;
  }

  if (url.pathname === "/__preview-gate" && context.request.method === "POST") {
    const form = await context.request.formData();
    const candidate = typeof form.get("password") === "string" ? form.get("password") : "";
    const next = safeNext(form.get("next"));
    if (!(await passwordMatches(candidate, password))) {
      return htmlResponse(next, "密码不正确，请重试。");
    }

    const session = await createSession(password);
    return new Response(null, {
      status: 303,
      headers: {
        "cache-control": "no-store",
        location: next,
        "set-cookie": `${COOKIE_NAME}=${session}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}`,
      },
    });
  }

  if (await hasValidSession(context.request, password)) {
    context.data.previewGateAuthenticated = true;
    return context.next();
  }

  if (wantsJson(context.request)) {
    return Response.json(
      { error: { code: "PREVIEW_AUTH_REQUIRED", message: "Preview authentication required." } },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }

  return htmlResponse(safeNext(`${url.pathname}${url.search}`));
}
