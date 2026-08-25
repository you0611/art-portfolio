import {
  ADMIN_EMAIL_OUTBOX_SQL,
  dispatchConfiguredEmails,
  emailDeliveryMode,
  mapEmailOutbox,
} from "../../_lib/email.js";
import { adminJson, adminMethodNotAllowed, adminServiceUnavailable } from "../../_lib/http.js";

export async function onRequest(context) {
  if (!["GET", "POST"].includes(context.request.method)) {
    return adminMethodNotAllowed(["GET", "POST"]);
  }

  try {
    if (context.request.method === "POST") {
      const delivery = await dispatchConfiguredEmails(context.env.DB, context.env);
      return adminJson(delivery);
    }

    const result = await context.env.DB.prepare(ADMIN_EMAIL_OUTBOX_SQL).all();
    return adminJson({ mode: emailDeliveryMode(context.env), emails: (result.results || []).map(mapEmailOutbox) });
  } catch {
    return adminServiceUnavailable();
  }
}
