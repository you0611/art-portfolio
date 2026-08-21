import { AccessConfigurationError, verifyAdminAccess } from "../../_lib/access.js";
import { json } from "../../_lib/http.js";

export async function onRequest(context) {
  try {
    context.data.admin = await verifyAdminAccess(context.request, context.env);
    return context.next();
  } catch (error) {
    if (error instanceof AccessConfigurationError) {
      return json(
        { error: { code: "ADMIN_AUTH_NOT_CONFIGURED", message: "Administrator access is unavailable." } },
        { status: 503 },
      );
    }
    return json(
      { error: { code: "FORBIDDEN", message: "Administrator authentication required." } },
      { status: 403 },
    );
  }
}
