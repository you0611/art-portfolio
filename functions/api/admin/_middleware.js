import { AccessConfigurationError, verifyAdminAccess, verifyLocalAdminPreview } from "../../_lib/access.js";
import { adminJson } from "../../_lib/http.js";

export async function onRequest(context) {
  try {
    context.data.admin = verifyLocalAdminPreview(context.request, context.env)
      || await verifyAdminAccess(context.request, context.env);
    return context.next();
  } catch (error) {
    if (error instanceof AccessConfigurationError) {
      return adminJson(
        { error: { code: "ADMIN_AUTH_NOT_CONFIGURED", message: "Administrator access is unavailable." } },
        { status: 503 },
      );
    }
    return adminJson(
      { error: { code: "FORBIDDEN", message: "Administrator authentication required." } },
      { status: 403 },
    );
  }
}
