import {
  ADMIN_ORDER_BY_ID_SQL,
  ADMIN_ORDER_OFFERS_SQL,
  ADMIN_ORDER_BODY_BYTES,
  CommerceInputError,
  mapAdminOrder,
  mapOffer,
  newOfferId,
  newRequestId,
  parseJsonBody,
  parseOffer,
  releaseExpiredInventoryHolds,
  validateOrderId,
} from "../../../../_lib/orders.js";
import { adminJson, adminMethodNotAllowed, adminServiceUnavailable } from "../../../../_lib/http.js";

function errorResponse(error) {
  if (error instanceof CommerceInputError) {
    return adminJson({ error: { code: error.code, message: error.message } }, { status: error.status });
  }
  return adminServiceUnavailable();
}

async function loadOrder(db, id) {
  const row = await db.prepare(ADMIN_ORDER_BY_ID_SQL).bind(id).first();
  if (!row) return null;
  const offers = await db.prepare(ADMIN_ORDER_OFFERS_SQL).bind(id).all();
  return mapAdminOrder(row, (offers.results || []).map(mapOffer));
}

export async function onRequest(context) {
  if (context.request.method !== "POST") return adminMethodNotAllowed(["POST"]);
  const id = validateOrderId(context.params?.id);
  if (!id) return adminJson({ error: { code: "INVALID_ORDER_ID", message: "Invalid order id." } }, { status: 400 });

  try {
    await releaseExpiredInventoryHolds(context.env.DB);
    const input = parseOffer(await parseJsonBody(context.request, ADMIN_ORDER_BODY_BYTES), { admin: true });
    const existing = await context.env.DB.prepare(ADMIN_ORDER_BY_ID_SQL).bind(id).first();
    if (!existing) return adminJson({ error: { code: "NOT_FOUND", message: "Order not found." } }, { status: 404 });
    const offerId = newOfferId();
    const requestId = newRequestId();
    const auditId = newRequestId();
    const details = JSON.stringify({ proposedBy: "admin", amountMinor: input.amountMinor, currency: input.currency });

    const insert = context.env.DB.prepare(
      `INSERT INTO offers (id, order_item_id, proposed_by, amount_minor, currency, message, expires_at)
       SELECT ?, oi.id, 'admin', ?, ?, ?, ?
       FROM orders o JOIN order_items oi ON oi.order_id = o.id
       WHERE o.id = ? AND o.version = ? AND o.status IN ('submitted', 'negotiating')`,
    ).bind(offerId, input.amountMinor, input.currency, input.message, input.expiresAt, id, input.version);
    const update = context.env.DB.prepare(
      `UPDATE orders
       SET status = CASE WHEN status = 'submitted' THEN 'negotiating' ELSE status END,
           version = version + 1,
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ? AND version = ? AND status IN ('submitted', 'negotiating')
       RETURNING version`,
    ).bind(id, input.version);
    const audit = context.env.DB.prepare(
      `INSERT INTO admin_audit_log
        (id, admin_email, action, entity_type, entity_id, request_id, details_json)
       SELECT ?, ?, 'create_offer', 'offer', ?, ?, ?
       WHERE changes() = 1`,
    ).bind(auditId, context.data.admin.email, offerId, requestId, details);

    const result = await context.env.DB.batch([insert, update, audit]);
    if (Number(result?.[0]?.meta?.changes || 0) !== 1 || Number(result?.[1]?.meta?.changes || 0) !== 1) {
      return adminJson(
        { error: { code: "VERSION_CONFLICT", message: "Order was modified by another administrator." } },
        { status: 409 },
      );
    }
    const order = await loadOrder(context.env.DB, id);
    if (!order) return adminServiceUnavailable();
    return adminJson({ order }, { status: 201, headers: { "x-request-id": requestId } });
  } catch (error) {
    return errorResponse(error);
  }
}
