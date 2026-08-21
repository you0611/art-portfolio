import { json, methodNotAllowed, serviceUnavailable } from "../_lib/http.js";

export async function onRequest(context) {
  if (context.request.method !== "GET") return methodNotAllowed(["GET"]);

  try {
    await context.env.DB.prepare("SELECT 1 AS ok").first();
    return json(
      { status: "ok", database: "ok" },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return serviceUnavailable();
  }
}
