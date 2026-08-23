import {
  ADMIN_ORDER_BY_ID_SQL,
  ADMIN_ORDER_BODY_BYTES,
  ADMIN_ORDER_OFFERS_SQL,
  CommerceInputError,
  mapAdminOrder,
  mapOffer,
  newRequestId,
  parseJsonBody,
  parseReleaseBody,
  validateOrderId,
  releaseExpiredInventoryHolds,
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
    const input = parseReleaseBody(await parseJsonBody(context.request, ADMIN_ORDER_BODY_BYTES));
    const existing = await context.env.DB.prepare(ADMIN_ORDER_BY_ID_SQL).bind(id).first();
    if (!existing) return adminJson({ error: { code: "NOT_FOUND", message: "Order not found." } }, { status: 404 });
    if (existing.version !== input.version) {
      return adminJson(
        { error: { code: "VERSION_CONFLICT", message: "Order was modified by another administrator." } },
        { status: 409 },
      );
    }
    if (existing.status !== "awaiting_payment" || !existing.holdId) {
      return adminJson(
        { error: { code: "NO_ACTIVE_HOLD", message: "This order has no active inventory hold." } },
        { status: 409 },
      );
    }

    const requestId = newRequestId();
    const auditId = newRequestId();
    const details = JSON.stringify({ orderId: id, artworkId: existing.artworkId });
    const releaseHold = context.env.DB.prepare(
      `UPDATE inventory_holds SET status = 'released', released_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ? AND order_id = ? AND status = 'active'`,
    ).bind(existing.holdId, id);
    const releaseArtwork = context.env.DB.prepare(
      `UPDATE artworks SET sale_status = 'available', version = version + 1,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ? AND sale_status = 'held'
         AND EXISTS (SELECT 1 FROM inventory_holds WHERE id = ? AND status = 'released')`,
    ).bind(existing.artworkId, existing.holdId);
    const updateOrder = context.env.DB.prepare(
      `UPDATE orders SET status = 'negotiating', version = version + 1,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ? AND version = ? AND status = 'awaiting_payment'
         AND EXISTS (SELECT 1 FROM inventory_holds WHERE id = ? AND status = 'released')`,
    ).bind(id, input.version, existing.holdId);
    const audit = context.env.DB.prepare(
      `INSERT INTO admin_audit_log
        (id, admin_email, action, entity_type, entity_id, request_id, details_json)
       SELECT ?, ?, 'release_inventory_hold', 'inventory_hold', ?, ?, ?
       WHERE EXISTS (
         SELECT 1 FROM inventory_holds h JOIN orders o ON o.id = h.order_id
         WHERE h.id = ? AND h.status = 'released' AND o.version = ?
       )`,
    ).bind(auditId, context.data.admin.email, existing.holdId, requestId, details, existing.holdId, input.version + 1);

    const result = await context.env.DB.batch([releaseHold, releaseArtwork, updateOrder, audit]);
    if (Number(result?.[0]?.meta?.changes || 0) !== 1 || Number(result?.[2]?.meta?.changes || 0) !== 1) {
      return adminJson(
        { error: { code: "HOLD_CONFLICT", message: "The inventory hold could not be released." } },
        { status: 409 },
      );
    }
    const order = await loadOrder(context.env.DB, id);
    if (!order) return adminServiceUnavailable();
    return adminJson({ order }, { headers: { "x-request-id": requestId } });
  } catch (error) {
    return errorResponse(error);
  }
}
