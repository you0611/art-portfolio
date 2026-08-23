import {
  ADMIN_ORDER_BY_ID_SQL,
  ADMIN_ORDER_OFFERS_SQL,
  canTransitionOrder,
  CommerceInputError,
  mapAdminOrder,
  mapOffer,
  newRequestId,
  parseJsonBody,
  parseOrderStatusPatch,
  releaseExpiredInventoryHolds,
  ADMIN_ORDER_BODY_BYTES,
  validateOrderId,
} from "../../../_lib/orders.js";
import { adminJson, adminMethodNotAllowed, adminServiceUnavailable } from "../../../_lib/http.js";

function errorResponse(error) {
  if (error instanceof CommerceInputError) {
    return adminJson({ error: { code: error.code, message: error.message } }, { status: error.status });
  }
  return adminServiceUnavailable();
}

async function loadOrder(db, id) {
  const row = await db.prepare(ADMIN_ORDER_BY_ID_SQL).bind(id).first();
  if (!row) return null;
  const offerResult = await db.prepare(ADMIN_ORDER_OFFERS_SQL).bind(id).all();
  return mapAdminOrder(row, (offerResult.results || []).map(mapOffer));
}

async function getOrder(context, id) {
  await releaseExpiredInventoryHolds(context.env.DB);
  const order = await loadOrder(context.env.DB, id);
  if (!order) return adminJson({ error: { code: "NOT_FOUND", message: "Order not found." } }, { status: 404 });
  return adminJson({ order });
}

async function patchOrder(context, id) {
  const input = parseOrderStatusPatch(await parseJsonBody(context.request, ADMIN_ORDER_BODY_BYTES));
  const existing = await context.env.DB.prepare(ADMIN_ORDER_BY_ID_SQL).bind(id).first();
  if (!existing) return adminJson({ error: { code: "NOT_FOUND", message: "Order not found." } }, { status: 404 });
  if (existing.version !== input.version) {
    return adminJson(
      { error: { code: "VERSION_CONFLICT", message: "Order was modified by another administrator." } },
      { status: 409 },
    );
  }
  if (!canTransitionOrder(existing.status, input.status)) {
    return adminJson(
      { error: { code: "INVALID_ORDER_TRANSITION", message: "This order status transition is not allowed." } },
      { status: 422 },
    );
  }

  const requestId = newRequestId();
  const auditId = newRequestId();
  const details = JSON.stringify({ statusFrom: existing.status, statusTo: input.status });
  const update = context.env.DB.prepare(
    `UPDATE orders
     SET status = ?, version = version + 1,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = ? AND version = ? AND status = ?
     RETURNING version`,
  ).bind(input.status, id, input.version, existing.status);
  const audit = context.env.DB.prepare(
    `INSERT INTO admin_audit_log
      (id, admin_email, action, entity_type, entity_id, request_id, details_json)
     SELECT ?, ?, 'update_order_status', 'order', ?, ?, ?
     WHERE changes() = 1`,
  ).bind(auditId, context.data.admin.email, id, requestId, details);
  const result = await context.env.DB.batch([update, audit]);
  if (Number(result?.[0]?.meta?.changes || 0) !== 1) {
    return adminJson(
      { error: { code: "VERSION_CONFLICT", message: "Order was modified by another administrator." } },
      { status: 409 },
    );
  }
  const order = await loadOrder(context.env.DB, id);
  if (!order) return adminServiceUnavailable();
  return adminJson({ order }, { headers: { "x-request-id": requestId } });
}

export async function onRequest(context) {
  const id = validateOrderId(context.params?.id);
  if (!id) return adminJson({ error: { code: "INVALID_ORDER_ID", message: "Invalid order id." } }, { status: 400 });
  try {
    if (context.request.method === "GET") return await getOrder(context, id);
    if (context.request.method === "PATCH") return await patchOrder(context, id);
    return adminMethodNotAllowed(["GET", "PATCH"]);
  } catch (error) {
    return errorResponse(error);
  }
}
