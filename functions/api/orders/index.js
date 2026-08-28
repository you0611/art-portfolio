import {
  CommerceInputError,
  newOrderId,
  newOrderItemId,
  newPublicReference,
  parseCustomerOrder,
  parseJsonBody,
  PUBLIC_ORDER_BODY_BYTES,
  PUBLIC_ORDER_SQL,
  releaseExpiredInventoryHolds,
  validateIdempotencyKey,
  mapPublicOrder,
} from "../../_lib/orders.js";
import { scheduleConfiguredEmailDispatch } from "../../_lib/email.js";
import { json, methodNotAllowed, serviceUnavailable } from "../../_lib/http.js";

function noStoreJson(data, init = {}) {
  return json(data, { ...init, headers: { ...(init.headers || {}), "cache-control": "no-store" } });
}

function inputError(error) {
  if (!(error instanceof CommerceInputError)) return serviceUnavailable();
  return noStoreJson({ error: { code: error.code, message: error.message } }, { status: error.status });
}

async function existingByIdempotency(db, key) {
  if (!key) return null;
  const row = await db
    .prepare(`${PUBLIC_ORDER_SQL.replace("WHERE o.public_reference = ?", "WHERE o.idempotency_key = ?")}`)
    .bind(key)
    .first();
  return row ? mapPublicOrder(row) : null;
}

export async function onRequest(context) {
  if (context.request.method !== "POST") return methodNotAllowed(["POST"]);

  try {
    await releaseExpiredInventoryHolds(context.env.DB);
    const body = await parseJsonBody(context.request, PUBLIC_ORDER_BODY_BYTES);
    const input = parseCustomerOrder(body);
    const idempotencyKey = validateIdempotencyKey(context.request.headers.get("idempotency-key"));
    const duplicate = await existingByIdempotency(context.env.DB, idempotencyKey);
    if (duplicate) return noStoreJson({ order: duplicate, reused: true });

    const orderId = newOrderId();
    const itemId = newOrderItemId();
    const reference = newPublicReference();
    const orderInsert = context.env.DB
      .prepare(
        `INSERT INTO orders
          (id, public_reference, status, customer_name, customer_email, customer_contact, customer_country_code,
           preferred_language, contact_note, shipping_note, idempotency_key)
         SELECT ?, ?, 'submitted', ?, ?, ?, ?, ?, ?, ?, ?
         WHERE EXISTS (
           SELECT 1 FROM artworks
           WHERE id = ? AND content_status = 'published'
             AND sale_status = 'available' AND negotiation_enabled = 1
         )`,
      )
      .bind(
        orderId,
        reference,
        input.customerName,
        input.customerEmail,
        input.customerContact,
        input.customerCountryCode,
        input.preferredLanguage,
        input.contactNote,
        input.shippingNote,
        idempotencyKey,
        input.artworkId,
      );
    const itemInsert = context.env.DB
      .prepare(
        `INSERT INTO order_items (id, order_id, artwork_id)
         SELECT ?, ?, ? WHERE EXISTS (SELECT 1 FROM orders WHERE id = ?)`,
      )
      .bind(itemId, orderId, input.artworkId, orderId);

    let batchResult;
    try {
      batchResult = await context.env.DB.batch([orderInsert, itemInsert]);
    } catch (error) {
      const duplicateAfterRace = await existingByIdempotency(context.env.DB, idempotencyKey);
      if (duplicateAfterRace) return noStoreJson({ order: duplicateAfterRace, reused: true });
      throw error;
    }

    const row = await context.env.DB.prepare(PUBLIC_ORDER_SQL).bind(reference).first();
    if (row) {
      scheduleConfiguredEmailDispatch(context);
      return noStoreJson({ order: mapPublicOrder(row) }, { status: 201 });
    }

    if (Number(batchResult?.[0]?.meta?.changes || 0) !== 1) {
      const artwork = await context.env.DB
        .prepare("SELECT content_status, sale_status, negotiation_enabled FROM artworks WHERE id = ?")
        .bind(input.artworkId)
        .first();
      if (artwork?.content_status === "published" && artwork?.sale_status === "available" && artwork?.negotiation_enabled === 1) {
        return serviceUnavailable();
      }
      return noStoreJson(
        { error: { code: "ARTWORK_UNAVAILABLE", message: "This artwork is not available for inquiry." } },
        { status: artwork ? 409 : 404 },
      );
    }

    return serviceUnavailable();
  } catch (error) {
    return inputError(error);
  }
}
