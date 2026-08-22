import { adminJson, adminMethodNotAllowed } from "../../_lib/http.js";

export async function onRequest(context) {
  if (context.request.method !== "GET") return adminMethodNotAllowed(["GET"]);
  return adminJson(
    { administrator: { email: context.data.admin.email } },
  );
}
