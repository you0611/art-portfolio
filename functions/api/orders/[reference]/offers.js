import {
  CommerceInputError,
  newOfferId,
  parseJsonBody,
  parseOffer,
  PUBLIC_OFFER_BODY_BYTES,
  releaseExpiredInventoryHolds,
  validatePublicReference,
} from "../../../_lib/orders.js";
import { json, methodNotAllowed, serviceUnavailable } from "../../../_lib/http.js";

function noStoreJson(data, init = {}) {
  return json(data, { ...init, headers: { ...(init.headers || {}), "cache-control": "no-store" } });
}

function inputError(error) {
  if (!(error instanceof CommerceInputError)) return serviceUnavailable();
  return noStoreJson({ error: { code: error.code, message: error.message } }, { status: error.status });
}

export async function onRequest(context) {
  if (context.request.method !== "POST") return methodNotAllowed(["POST"]);
  const reference = validatePublicReference(context.params?.reference);
  if (!reference) {
    return noStoreJson({ error: { code: "NOT_FOUND", message: "Order not found." } }, { status: 404 });
  }

  try {
    await releaseExpiredInventoryHolds(context.env.DB);
    const input = parseOffer(await parseJsonBody(context.request, PUBLIC_OFFER_BODY_BYTES));
    const offerId = newOfferId();
    const insert = context.env.DB.prepare(
      `INSERT INTO offers (id, order_item_id, proposed_by, amount_minor, currency, message)
       SELECT ?, oi.id, 'customer', ?, ?, ?
       FROM orders o JOIN order_items oi ON oi.order_id = o.id
       JOIN artworks a ON a.id = oi.artwork_id
       WHERE o.public_reference = ? AND o.status IN ('submitted', 'negotiating')
         AND a.sale_status = 'available' AND a.negotiation_enabled = 1`,
    ).bind(offerId, input.amountMinor, input.currency, input.message, reference);
    const update = context.env.DB.prepare(
      `UPDATE orders
       SET status = CASE WHEN status = 'submitted' THEN 'negotiating' ELSE status END,
           version = version + 1,
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE public_reference = ? AND status IN ('submitted', 'negotiating')
         AND EXISTS (SELECT 1 FROM offers WHERE id = ?)`
    ).bind(reference, offerId);
    const result = await context.env.DB.batch([insert, update]);
    const persistedOffer = await context.env.DB
      .prepare("SELECT id FROM offers WHERE id = ?")
      .bind(offerId)
      .first();
    if (!persistedOffer) {
      return noStoreJson(
        { error: { code: "ORDER_NOT_OPEN", message: "This inquiry is no longer open for offers." } },
        { status: 409 },
      );
    }
    return noStoreJson(
      {
        offer: {
          amountMinor: input.amountMinor,
          currency: input.currency,
          proposedBy: "customer",
          status: "pending",
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return inputError(error);
  }
}
