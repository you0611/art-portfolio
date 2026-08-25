import {
  ADMIN_ORDER_BY_ID_SQL,
  ADMIN_ORDER_EVENTS_SQL,
  ADMIN_ORDER_BODY_BYTES,
  CommerceInputError,
  mapAdminOrder,
  mapOffer,
  mapNotificationEvent,
  newHoldId,
  newRequestId,
  parseHoldBody,
  parseJsonBody,
  validateOrderId,
  holdExpiry,
  releaseExpiredInventoryHolds,
  ADMIN_ORDER_OFFERS_SQL,
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
  const events = await db.prepare(ADMIN_ORDER_EVENTS_SQL).bind(id).all();
  return mapAdminOrder(
    row,
    (offers.results || []).map(mapOffer),
    (events.results || []).map(mapNotificationEvent),
  );
}

export async function onRequest(context) {
  if (context.request.method !== "POST") return adminMethodNotAllowed(["POST"]);
  const id = validateOrderId(context.params?.id);
  if (!id) return adminJson({ error: { code: "INVALID_ORDER_ID", message: "Invalid order id." } }, { status: 400 });

  try {
    await releaseExpiredInventoryHolds(context.env.DB);
    const input = parseHoldBody(await parseJsonBody(context.request, ADMIN_ORDER_BODY_BYTES));
    const existing = await context.env.DB.prepare(ADMIN_ORDER_BY_ID_SQL).bind(id).first();
    if (!existing) return adminJson({ error: { code: "NOT_FOUND", message: "Order not found." } }, { status: 404 });
    if (existing.version !== input.version) {
      return adminJson(
        { error: { code: "VERSION_CONFLICT", message: "Order was modified by another administrator." } },
        { status: 409 },
      );
    }
    if (!["negotiating", "awaiting_payment"].includes(existing.status)) {
      return adminJson(
        { error: { code: "INVALID_HOLD_STATE", message: "The order is not ready for an inventory hold." } },
        { status: 422 },
      );
    }

    const holdId = newHoldId();
    const expiresAt = holdExpiry(input.durationMinutes);
    const requestId = newRequestId();
    const auditId = newRequestId();
    const details = JSON.stringify({ orderId: id, artworkId: existing.artworkId, expiresAt });
    const insertHold = context.env.DB.prepare(
      `INSERT INTO inventory_holds (id, artwork_id, order_id, status, expires_at)
       SELECT ?, oi.artwork_id, o.id, 'active', ?
       FROM orders o JOIN order_items oi ON oi.order_id = o.id
       JOIN artworks a ON a.id = oi.artwork_id
       JOIN offers f ON f.order_item_id = oi.id
       WHERE o.id = ? AND o.version = ? AND o.status IN ('negotiating', 'awaiting_payment')
         AND f.id = ? AND f.status = 'pending' AND a.sale_status = 'available'
         AND (f.expires_at IS NULL OR f.expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`,
    ).bind(holdId, expiresAt, id, input.version, input.offerId);
    const acceptOffer = context.env.DB.prepare(
      `UPDATE offers SET status = 'accepted', responded_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ? AND status = 'pending'
         AND EXISTS (SELECT 1 FROM inventory_holds WHERE id = ? AND status = 'active')`,
    ).bind(input.offerId, holdId);
    const rejectOthers = context.env.DB.prepare(
      `UPDATE offers SET status = 'rejected', responded_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE order_item_id = (SELECT order_item_id FROM offers WHERE id = ?)
         AND id <> ? AND status = 'pending'
         AND EXISTS (SELECT 1 FROM inventory_holds WHERE id = ? AND status = 'active')`,
    ).bind(input.offerId, input.offerId, holdId);
    const markArtworkHeld = context.env.DB.prepare(
      `UPDATE artworks SET sale_status = 'held', version = version + 1,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ? AND sale_status = 'available'
         AND EXISTS (SELECT 1 FROM inventory_holds WHERE id = ? AND status = 'active')`,
    ).bind(existing.artworkId, holdId);
    const updateOrder = context.env.DB.prepare(
      `UPDATE orders SET status = 'awaiting_payment', version = version + 1,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ? AND version = ? AND status IN ('negotiating', 'awaiting_payment')
         AND EXISTS (SELECT 1 FROM inventory_holds WHERE id = ? AND status = 'active')`,
    ).bind(id, input.version, holdId);
    const audit = context.env.DB.prepare(
      `INSERT INTO admin_audit_log
        (id, admin_email, action, entity_type, entity_id, request_id, details_json)
       SELECT ?, ?, 'create_inventory_hold', 'inventory_hold', ?, ?, ?
       WHERE EXISTS (
         SELECT 1 FROM inventory_holds h JOIN orders o ON o.id = h.order_id
         WHERE h.id = ? AND h.status = 'active' AND o.version = ?
       )`,
    ).bind(auditId, context.data.admin.email, holdId, requestId, details, holdId, input.version + 1);

    await context.env.DB.batch([
      insertHold,
      acceptOffer,
      rejectOthers,
      markArtworkHeld,
      updateOrder,
      audit,
    ]);
    const order = await loadOrder(context.env.DB, id);
    const acceptedOffer = order?.offers.find((offer) => offer.id === input.offerId);
    if (
      !order
      || Number(order.version) <= input.version
      || order.status !== "awaiting_payment"
      || order.artwork.saleStatus !== "held"
      || order.activeHold?.id !== holdId
      || acceptedOffer?.status !== "accepted"
    ) {
      return adminJson(
        { error: { code: "HOLD_UNAVAILABLE", message: "The offer or artwork is no longer available for a hold." } },
        { status: 409 },
      );
    }
    return adminJson({ order }, { status: 201, headers: { "x-request-id": requestId } });
  } catch (error) {
    return errorResponse(error);
  }
}
