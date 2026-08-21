const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "x-content-type-options": "nosniff",
};

export function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  for (const [name, value] of Object.entries(JSON_HEADERS)) {
    if (!headers.has(name)) headers.set(name, value);
  }
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function methodNotAllowed(allowed) {
  return json(
    { error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed." } },
    { status: 405, headers: { allow: allowed.join(", ") } },
  );
}

export function serviceUnavailable() {
  return json(
    { error: { code: "SERVICE_UNAVAILABLE", message: "Service temporarily unavailable." } },
    { status: 503 },
  );
}
