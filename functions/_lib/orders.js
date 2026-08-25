export const PUBLIC_ORDER_BODY_BYTES = 16 * 1024;
export const PUBLIC_OFFER_BODY_BYTES = 8 * 1024;
export const ADMIN_ORDER_BODY_BYTES = 8 * 1024;
export const FOLLOW_UP_STATUSES = ["unprocessed", "contacting", "completed", "cancelled"];

export class CommerceInputError extends Error {
  constructor(code, message, status = 422) {
    super(message);
    this.name = "CommerceInputError";
    this.code = code;
    this.status = status;
  }
}

function invalid(field, message) {
  throw new CommerceInputError("INVALID_COMMERCE_FIELD", `${field}: ${message}`);
}

function requiredString(field, value, maxLength) {
  if (typeof value !== "string") invalid(field, "must be a string");
  const normalized = value.trim();
  if (!normalized) invalid(field, "must not be empty");
  if (normalized.length > maxLength) invalid(field, `must be at most ${maxLength} characters`);
  return normalized;
}

function optionalString(field, value, maxLength) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") invalid(field, "must be a string");
  const normalized = value.trim();
  if (normalized.length > maxLength) invalid(field, `must be at most ${maxLength} characters`);
  return normalized;
}

function enumValue(field, value, allowed) {
  if (typeof value !== "string" || !allowed.includes(value)) invalid(field, "has an unsupported value");
  return value;
}

function integer(field, value, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    invalid(field, `must be an integer between ${min} and ${max}`);
  }
  return value;
}

function currency(value) {
  const normalized = requiredString("currency", value, 3).toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) invalid("currency", "must be a three-letter currency code");
  return normalized;
}

function optionalEmail(value) {
  if (value === undefined || value === null || value === "") return "";
  const normalized = requiredString("customerEmail", value, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) invalid("customerEmail", "must be a valid email address");
  return normalized;
}

function optionalCountryCode(value) {
  if (value === undefined || value === null || value === "") return null;
  const normalized = requiredString("customerCountryCode", value, 2).toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) invalid("customerCountryCode", "must be a two-letter country code");
  return normalized;
}

function assertObject(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new CommerceInputError("INVALID_JSON", "Request body must be a JSON object.", 400);
  }
}

export async function parseJsonBody(request, maxBytes) {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    throw new CommerceInputError("UNSUPPORTED_MEDIA_TYPE", "Content-Type must be application/json.", 415);
  }

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new CommerceInputError("REQUEST_TOO_LARGE", "Request body is too large.", 413);
  }

  const bodyText = await request.text();
  if (new TextEncoder().encode(bodyText).byteLength > maxBytes) {
    throw new CommerceInputError("REQUEST_TOO_LARGE", "Request body is too large.", 413);
  }

  let body;
  try {
    body = JSON.parse(bodyText);
  } catch {
    throw new CommerceInputError("INVALID_JSON", "Request body must be valid JSON.", 400);
  }
  assertObject(body);
  return body;
}

function rejectUnknownFields(body, allowed) {
  if (Object.keys(body).some((key) => !allowed.has(key))) {
    throw new CommerceInputError("UNKNOWN_FIELD", "Request contains an unsupported field.", 400);
  }
}

export function parseCustomerOrder(body) {
  rejectUnknownFields(
    body,
    new Set([
      "artworkId",
      "customerName",
      "customerEmail",
      "customerContact",
      "customerCountryCode",
      "preferredLanguage",
      "contactNote",
      "shippingNote",
    ]),
  );
  return {
    artworkId: validateArtworkId(body.artworkId),
    customerName: requiredString("customerName", body.customerName, 120),
    customerEmail: optionalEmail(body.customerEmail),
    customerContact: requiredString("customerContact", body.customerContact, 200),
    customerCountryCode: optionalCountryCode(body.customerCountryCode),
    preferredLanguage: enumValue("preferredLanguage", body.preferredLanguage ?? "zh", ["zh", "en"]),
    contactNote: optionalString("contactNote", body.contactNote, 2_000),
    shippingNote: optionalString("shippingNote", body.shippingNote, 1_000),
  };
}

export function parseOffer(body, { admin = false } = {}) {
  const allowed = new Set(["amountMinor", "currency", "message"]);
  if (admin) {
    allowed.add("expiresAt");
    allowed.add("version");
  }
  rejectUnknownFields(body, allowed);
  const result = {
    amountMinor: integer("amountMinor", body.amountMinor, 0, 1_000_000_000_000),
    currency: currency(body.currency),
    message: optionalString("message", body.message, 2_000),
  };
  if (admin) {
    result.version = integer("version", body.version, 1, 2_147_483_647);
    result.expiresAt = parseFutureTimestamp(body.expiresAt);
  }
  return result;
}

function parseFutureTimestamp(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") invalid("expiresAt", "must be an ISO timestamp");
  const time = Date.parse(value);
  const now = Date.now();
  if (!Number.isFinite(time) || time <= now || time > now + 30 * 24 * 60 * 60 * 1000) {
    invalid("expiresAt", "must be within the next 30 days");
  }
  return new Date(time).toISOString();
}

export function parseOrderStatusPatch(body) {
  rejectUnknownFields(body, new Set(["version", "status", "followUpStatus", "nextFollowUpAt", "adminNote"]));
  const result = {
    version: integer("version", body.version, 1, 2_147_483_647),
    status: body.status === undefined ? null : enumValue("status", body.status, ["negotiating", "awaiting_payment", "cancelled"]),
  };
  if (body.followUpStatus !== undefined) {
    result.followUpStatus = enumValue("followUpStatus", body.followUpStatus, FOLLOW_UP_STATUSES);
  }
  if (body.nextFollowUpAt !== undefined) {
    result.nextFollowUpAt = parseFollowUpTimestamp(body.nextFollowUpAt);
  }
  if (body.adminNote !== undefined) {
    result.adminNote = optionalString("adminNote", body.adminNote, 4_000);
  }
  if (result.status === null && result.followUpStatus === undefined && result.nextFollowUpAt === undefined && result.adminNote === undefined) {
    throw new CommerceInputError("EMPTY_ORDER_PATCH", "At least one order field must be provided.", 400);
  }
  return result;
}

function parseFollowUpTimestamp(value) {
  if (value === null || value === "") return null;
  if (typeof value !== "string") invalid("nextFollowUpAt", "must be an ISO timestamp or null");
  const time = Date.parse(value);
  if (!Number.isFinite(time)) invalid("nextFollowUpAt", "must be an ISO timestamp or null");
  return new Date(time).toISOString();
}

export function parseHoldBody(body) {
  rejectUnknownFields(body, new Set(["version", "offerId", "durationMinutes"]));
  return {
    version: integer("version", body.version, 1, 2_147_483_647),
    offerId: validateId(body.offerId, "offerId"),
    durationMinutes: integer("durationMinutes", body.durationMinutes ?? 1440, 5, 43_200),
  };
}

export function parseReleaseBody(body) {
  rejectUnknownFields(body, new Set(["version"]));
  return { version: integer("version", body.version, 1, 2_147_483_647) };
}

export function validateId(value, field = "id") {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,95}$/.test(value)) invalid(field, "has an invalid format");
  return value;
}

export function validateArtworkId(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(value)) {
    invalid("artworkId", "has an invalid format");
  }
  return value;
}

export function validateOrderId(value) {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{0,95}$/.test(value) ? value : null;
}

export function validatePublicReference(value) {
  return typeof value === "string" && /^YX-[A-F0-9]{32}$/.test(value) ? value : null;
}

export function validateIdempotencyKey(value) {
  if (value === null || value === undefined || value === "") return null;
  const normalized = value.trim();
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(normalized)) {
    throw new CommerceInputError("INVALID_IDEMPOTENCY_KEY", "Idempotency-Key has an invalid format.", 400);
  }
  return normalized;
}

export function newOrderId() {
  return `order-${globalThis.crypto.randomUUID()}`;
}

export function newOrderItemId() {
  return `item-${globalThis.crypto.randomUUID()}`;
}

export function newOfferId() {
  return `offer-${globalThis.crypto.randomUUID()}`;
}

export function newHoldId() {
  return `hold-${globalThis.crypto.randomUUID()}`;
}

export function newRequestId() {
  return globalThis.crypto.randomUUID();
}

export function newPublicReference() {
  return `YX-${globalThis.crypto.randomUUID().replaceAll("-", "").toUpperCase()}`;
}

export function holdExpiry(durationMinutes) {
  return new Date(Date.now() + durationMinutes * 60_000).toISOString();
}

export async function releaseExpiredInventoryHolds(db) {
  return db.batch([
    db.prepare(
      `UPDATE offers
       SET status = 'expired', responded_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE status = 'pending' AND expires_at IS NOT NULL
         AND expires_at <= strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
    ),
    db.prepare(
      `UPDATE inventory_holds
       SET status = 'expired', released_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE status = 'active' AND expires_at <= strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
    ),
    db.prepare(
      `UPDATE artworks
       SET sale_status = 'available', version = version + 1,
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE sale_status = 'held'
         AND NOT EXISTS (
           SELECT 1 FROM inventory_holds
           WHERE inventory_holds.artwork_id = artworks.id AND status = 'active'
         )`,
    ),
    db.prepare(
      `UPDATE orders
       SET status = 'negotiating', version = version + 1,
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE status = 'awaiting_payment'
         AND NOT EXISTS (
           SELECT 1 FROM inventory_holds
           WHERE inventory_holds.order_id = orders.id AND status = 'active'
         )
         AND EXISTS (
           SELECT 1 FROM inventory_holds
           WHERE inventory_holds.order_id = orders.id AND status = 'expired'
         )`,
    ),
  ]);
}

export const PUBLIC_ORDER_SQL = `
  SELECT o.id, o.public_reference AS reference, o.status, o.preferred_language AS preferredLanguage,
    o.created_at AS createdAt, o.updated_at AS updatedAt,
    a.id AS artworkId, a.title_zh AS artworkTitleZh, a.title_en AS artworkTitleEn,
    a.sale_status AS artworkSaleStatus,
    latest.amount_minor AS latestOfferAmountMinor, latest.currency AS latestOfferCurrency,
    latest.proposed_by AS latestOfferProposedBy, latest.message AS latestOfferMessage,
    latest.status AS latestOfferStatus, latest.created_at AS latestOfferCreatedAt
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  JOIN artworks a ON a.id = oi.artwork_id
  LEFT JOIN offers latest ON latest.id = (
    SELECT id FROM offers WHERE order_item_id = oi.id ORDER BY created_at DESC, id DESC LIMIT 1
  )
  WHERE o.public_reference = ?
`;

export const ADMIN_ORDER_SELECT = `
  SELECT o.id, o.public_reference AS reference, o.status, o.version,
    o.customer_name AS customerName, o.customer_email AS customerEmail,
    o.customer_contact AS customerContact, o.customer_country_code AS customerCountryCode,
    o.preferred_language AS preferredLanguage, o.contact_note AS contactNote,
    o.shipping_note AS shippingNote, o.follow_up_status AS followUpStatus,
    o.next_follow_up_at AS nextFollowUpAt, o.admin_note AS adminNote,
    o.created_at AS createdAt, o.updated_at AS updatedAt,
    oi.id AS orderItemId, a.id AS artworkId, a.title_zh AS artworkTitleZh,
    a.title_en AS artworkTitleEn,
    CASE WHEN ma.id IS NULL THEN a.image_url ELSE '/api/media/' || ma.id END AS artworkImage,
    a.sale_status AS artworkSaleStatus,
    ih.id AS holdId, ih.status AS holdStatus, ih.expires_at AS holdExpiresAt,
    latest.id AS latestOfferId, latest.amount_minor AS latestOfferAmountMinor,
    latest.currency AS latestOfferCurrency, latest.proposed_by AS latestOfferProposedBy,
    latest.message AS latestOfferMessage, latest.status AS latestOfferStatus,
    latest.created_at AS latestOfferCreatedAt
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  JOIN artworks a ON a.id = oi.artwork_id
  LEFT JOIN media_assets ma ON ma.id = a.primary_media_id AND ma.status = 'active'
  LEFT JOIN inventory_holds ih ON ih.order_id = o.id AND ih.status = 'active'
  LEFT JOIN offers latest ON latest.id = (
    SELECT id FROM offers WHERE order_item_id = oi.id ORDER BY created_at DESC, id DESC LIMIT 1
  )
`;

export const ADMIN_ORDERS_SQL = `${ADMIN_ORDER_SELECT} ORDER BY o.created_at DESC, o.id DESC LIMIT 100`;
export const ADMIN_ORDER_BY_ID_SQL = `${ADMIN_ORDER_SELECT} WHERE o.id = ?`;
export const ADMIN_ORDER_OFFERS_SQL = `
  SELECT id, proposed_by AS proposedBy, amount_minor AS amountMinor, currency, message,
    status, expires_at AS expiresAt, created_at AS createdAt, responded_at AS respondedAt
  FROM offers
  WHERE order_item_id = (SELECT id FROM order_items WHERE order_id = ?)
  ORDER BY created_at ASC, id ASC
`;
export const ADMIN_ORDER_EVENTS_SQL = `
  SELECT id, event_type AS eventType, delivery_status AS deliveryStatus,
    attempt_count AS attemptCount, failure_message AS failureMessage,
    details_json AS detailsJson, created_at AS createdAt
  FROM notification_events
  WHERE order_id = ?
  ORDER BY created_at DESC, id DESC
`;

export function mapPublicOrder(row) {
  if (!row) return null;
  return {
    reference: row.reference,
    status: row.status,
    preferredLanguage: row.preferredLanguage,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    artwork: {
      id: row.artworkId,
      titleZh: row.artworkTitleZh,
      titleEn: row.artworkTitleEn,
      saleStatus: row.artworkSaleStatus,
    },
    latestOffer: row.latestOfferStatus
      ? {
          amountMinor: row.latestOfferAmountMinor,
          currency: row.latestOfferCurrency,
          proposedBy: row.latestOfferProposedBy,
          message: row.latestOfferMessage,
          status: row.latestOfferStatus,
          createdAt: row.latestOfferCreatedAt,
        }
      : null,
  };
}

export function mapAdminOrder(row, offers = [], notificationEvents = []) {
  if (!row) return null;
  return {
    id: row.id,
    reference: row.reference,
    status: row.status,
    version: row.version,
    customer: {
      name: row.customerName,
      email: row.customerEmail,
      contact: row.customerContact,
      countryCode: row.customerCountryCode,
      preferredLanguage: row.preferredLanguage,
    },
    contactNote: row.contactNote,
    shippingNote: row.shippingNote,
    followUp: {
      status: row.followUpStatus,
      nextAt: row.nextFollowUpAt,
      note: row.adminNote,
    },
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    artwork: {
      id: row.artworkId,
      titleZh: row.artworkTitleZh,
      titleEn: row.artworkTitleEn,
      image: row.artworkImage,
      saleStatus: row.artworkSaleStatus,
    },
    activeHold: row.holdId
      ? { id: row.holdId, status: row.holdStatus, expiresAt: row.holdExpiresAt }
      : null,
    latestOffer: row.latestOfferId
      ? {
          id: row.latestOfferId,
          amountMinor: row.latestOfferAmountMinor,
          currency: row.latestOfferCurrency,
          proposedBy: row.latestOfferProposedBy,
          message: row.latestOfferMessage,
          status: row.latestOfferStatus,
          createdAt: row.latestOfferCreatedAt,
        }
      : null,
    offers,
    notificationEvents,
  };
}

export function mapNotificationEvent(row) {
  if (!row) return null;
  return {
    id: row.id,
    eventType: row.eventType,
    deliveryStatus: row.deliveryStatus,
    attemptCount: row.attemptCount,
    failureMessage: row.failureMessage,
    detailsJson: row.detailsJson,
    createdAt: row.createdAt,
  };
}

export function mapOffer(row) {
  if (!row) return null;
  return {
    id: row.id,
    proposedBy: row.proposedBy,
    amountMinor: row.amountMinor,
    currency: row.currency,
    message: row.message,
    status: row.status,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    respondedAt: row.respondedAt,
  };
}

export function canTransitionOrder(from, to) {
  return (
    (from === "submitted" && ["negotiating", "cancelled"].includes(to)) ||
    (from === "negotiating" && ["awaiting_payment", "cancelled"].includes(to)) ||
    (from === "awaiting_payment" && to === "cancelled")
  );
}
