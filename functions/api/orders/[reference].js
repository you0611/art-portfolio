import {
  CommerceInputError,
  mapPublicOrder,
  PUBLIC_ORDER_SQL,
  releaseExpiredInventoryHolds,
  validatePublicReference,
} from "../../_lib/orders.js";
import { json, methodNotAllowed, serviceUnavailable } from "../../_lib/http.js";

function noStoreJson(data, init = {}) {
  return json(data, { ...init, headers: { ...(init.headers || {}), "cache-control": "no-store" } });
}

export async function onRequest(context) {
  if (context.request.method !== "GET") return methodNotAllowed(["GET"]);
  const reference = validatePublicReference(context.params?.reference);
  if (!reference) {
    return noStoreJson({ error: { code: "NOT_FOUND", message: "Order not found." } }, { status: 404 });
  }

  try {
    await releaseExpiredInventoryHolds(context.env.DB);
    const row = await context.env.DB.prepare(PUBLIC_ORDER_SQL).bind(reference).first();
    if (!row) {
      return noStoreJson({ error: { code: "NOT_FOUND", message: "Order not found." } }, { status: 404 });
    }
    return noStoreJson({ order: mapPublicOrder(row) });
  } catch {
    return serviceUnavailable();
  }
}
