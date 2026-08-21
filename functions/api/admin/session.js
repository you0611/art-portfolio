import { json, methodNotAllowed } from "../../_lib/http.js";

export async function onRequest(context) {
  if (context.request.method !== "GET") return methodNotAllowed(["GET"]);
  return json(
    { administrator: { email: context.data.admin.email } },
    { headers: { "cache-control": "no-store" } },
  );
}
