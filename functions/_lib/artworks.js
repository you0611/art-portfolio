export const ADMIN_ARTWORK_SELECT = `
  SELECT
    id, title_zh AS titleZh, title_en AS titleEn, category,
    medium, dimensions, year, image_url AS image,
    description_zh AS descriptionZh, description_en AS descriptionEn,
    detail_path_zh AS detailPathZh, detail_path_en AS detailPathEn,
    content_status AS contentStatus, sale_status AS saleStatus,
    price_minor AS priceMinor, currency, price_visibility AS priceVisibility,
    negotiation_enabled AS negotiationEnabled, display_order AS displayOrder,
    version, created_at AS createdAt, updated_at AS updatedAt
  FROM artworks
`;

export const ADMIN_ARTWORKS_SQL = `${ADMIN_ARTWORK_SELECT} ORDER BY display_order ASC, id ASC`;
export const ADMIN_ARTWORK_BY_ID_SQL = `${ADMIN_ARTWORK_SELECT} WHERE id = ?`;

const PATCH_COLUMNS = Object.freeze({
  titleZh: "title_zh",
  titleEn: "title_en",
  category: "category",
  medium: "medium",
  dimensions: "dimensions",
  year: "year",
  image: "image_url",
  descriptionZh: "description_zh",
  descriptionEn: "description_en",
  detailPathZh: "detail_path_zh",
  detailPathEn: "detail_path_en",
  contentStatus: "content_status",
  saleStatus: "sale_status",
  priceMinor: "price_minor",
  currency: "currency",
  priceVisibility: "price_visibility",
  negotiationEnabled: "negotiation_enabled",
  displayOrder: "display_order",
});

export const PATCHABLE_ARTWORK_FIELDS = new Set(Object.keys(PATCH_COLUMNS));
export const MAX_ARTWORK_PATCH_BYTES = 32 * 1024;

export class ArtworkInputError extends Error {
  constructor(code, message, status = 422) {
    super(message);
    this.name = "ArtworkInputError";
    this.code = code;
    this.status = status;
  }
}

function invalid(field, message) {
  throw new ArtworkInputError("INVALID_ARTWORK_FIELD", `${field}: ${message}`);
}

function requiredString(field, value, maxLength) {
  if (typeof value !== "string") invalid(field, "must be a string");
  const normalized = value.trim();
  if (!normalized) invalid(field, "must not be empty");
  if (normalized.length > maxLength) invalid(field, `must be at most ${maxLength} characters`);
  return normalized;
}

function textString(field, value, maxLength) {
  if (typeof value !== "string") invalid(field, "must be a string");
  const normalized = value.trim();
  if (normalized.length > maxLength) invalid(field, `must be at most ${maxLength} characters`);
  return normalized;
}

function integer(field, value, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    invalid(field, `must be an integer between ${min} and ${max}`);
  }
  return value;
}

function enumValue(field, value, allowed) {
  if (typeof value !== "string" || !allowed.includes(value)) {
    invalid(field, "has an unsupported value");
  }
  return value;
}

function imagePath(field, value, allowNull = false) {
  if (allowNull && value === null) return null;
  if (typeof value !== "string") invalid(field, "must be a site-relative path");
  const normalized = value.trim();
  if (
    normalized.length === 0 ||
    normalized.length > 300 ||
    !normalized.startsWith("/") ||
    normalized.startsWith("//") ||
    normalized.includes("..") ||
    normalized.includes("\\") ||
    !/^\/(?:assets|works)\/[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(normalized)
  ) {
    invalid(field, "must be a safe /assets/ or /works/ path");
  }
  return normalized;
}

function detailPath(field, value) {
  if (value === null) return null;
  if (typeof value !== "string") invalid(field, "must be a site-relative detail path");
  const normalized = value.trim();
  if (
    normalized.length === 0 ||
    normalized.length > 300 ||
    normalized.includes("..") ||
    normalized.includes("\\") ||
    !/^\/works\/[A-Za-z0-9][A-Za-z0-9._-]*\.html$/.test(normalized)
  ) {
    invalid(field, "must be a safe /works/*.html path");
  }
  return normalized;
}

function parsePriceMinor(value) {
  if (value === null) return null;
  return integer("priceMinor", value, 0, 1_000_000_000_000);
}

function parseNegotiationEnabled(value) {
  if (value === true || value === 1) return 1;
  if (value === false || value === 0) return 0;
  invalid("negotiationEnabled", "must be a boolean");
}

export function validateArtworkId(id) {
  if (typeof id !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(id)) return null;
  return id;
}

export async function parseArtworkPatch(request) {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    throw new ArtworkInputError("UNSUPPORTED_MEDIA_TYPE", "Content-Type must be application/json.", 415);
  }

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_ARTWORK_PATCH_BYTES) {
    throw new ArtworkInputError("REQUEST_TOO_LARGE", "Request body is too large.", 413);
  }

  const bodyText = await request.text();
  if (new TextEncoder().encode(bodyText).byteLength > MAX_ARTWORK_PATCH_BYTES) {
    throw new ArtworkInputError("REQUEST_TOO_LARGE", "Request body is too large.", 413);
  }

  let body;
  try {
    body = JSON.parse(bodyText);
  } catch {
    throw new ArtworkInputError("INVALID_JSON", "Request body must be valid JSON.", 400);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ArtworkInputError("INVALID_JSON", "Request body must be a JSON object.", 400);
  }

  const keys = Object.keys(body);
  if (!Object.prototype.hasOwnProperty.call(body, "version")) {
    throw new ArtworkInputError("VERSION_REQUIRED", "Current version is required.", 400);
  }
  if (keys.some((key) => key !== "version" && !PATCHABLE_ARTWORK_FIELDS.has(key))) {
    throw new ArtworkInputError("UNKNOWN_FIELD", "Request contains an unsupported field.", 400);
  }
  const version = integer("version", body.version, 1, 2_147_483_647);
  if (keys.length === 1) {
    throw new ArtworkInputError("NO_CHANGES", "At least one artwork field is required.", 400);
  }

  const patch = { version };
  for (const [field, value] of Object.entries(body)) {
    if (field === "version") continue;
    switch (field) {
      case "titleZh":
      case "titleEn":
        patch[field] = requiredString(field, value, 200);
        break;
      case "category":
      case "medium":
      case "dimensions":
        patch[field] = requiredString(field, value, 120);
        break;
      case "year":
        patch[field] = integer(field, value, 1900, 2200);
        break;
      case "image":
        patch[field] = imagePath(field, value);
        break;
      case "descriptionZh":
      case "descriptionEn":
        patch[field] = textString(field, value, 5_000);
        break;
      case "detailPathZh":
      case "detailPathEn":
        patch[field] = detailPath(field, value);
        break;
      case "contentStatus":
        patch[field] = enumValue(field, value, ["draft", "published", "archived"]);
        break;
      case "saleStatus":
        if (value === "held") {
          throw new ArtworkInputError("HELD_STATUS_FLOW_ONLY", "held is reserved for the inventory hold flow.", 422);
        }
        patch[field] = enumValue(field, value, ["available", "sold", "not_for_sale"]);
        break;
      case "priceMinor":
        patch[field] = parsePriceMinor(value);
        break;
      case "currency":
        patch[field] = requiredString(field, value, 3).toUpperCase();
        if (!/^[A-Z]{3}$/.test(patch[field])) invalid(field, "must be a three-letter currency code");
        break;
      case "priceVisibility":
        patch[field] = enumValue(field, value, ["on_request", "private_quote"]);
        break;
      case "negotiationEnabled":
        patch[field] = parseNegotiationEnabled(value);
        break;
      case "displayOrder":
        patch[field] = integer(field, value, 0, 100_000);
        break;
      default:
        throw new ArtworkInputError("UNKNOWN_FIELD", "Request contains an unsupported field.", 400);
    }
  }
  return patch;
}

export function mapArtwork(row) {
  if (!row) return null;
  return {
    ...row,
    negotiationEnabled: Boolean(row.negotiationEnabled),
  };
}

export function buildArtworkUpdateBatch(db, id, patch, adminEmail, requestId) {
  const fields = Object.keys(patch).filter((field) => field !== "version");
  const assignments = fields.map((field) => `${PATCH_COLUMNS[field]} = ?`);
  const values = fields.map((field) => patch[field]);
  const updateSql = `
    UPDATE artworks
    SET ${assignments.join(", ")},
        version = version + 1,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = ? AND version = ?
    RETURNING id, title_zh AS titleZh, title_en AS titleEn, category,
      medium, dimensions, year, image_url AS image,
      description_zh AS descriptionZh, description_en AS descriptionEn,
      detail_path_zh AS detailPathZh, detail_path_en AS detailPathEn,
      content_status AS contentStatus, sale_status AS saleStatus,
      price_minor AS priceMinor, currency, price_visibility AS priceVisibility,
      negotiation_enabled AS negotiationEnabled, display_order AS displayOrder,
      version, created_at AS createdAt, updated_at AS updatedAt
  `;
  const detailsJson = JSON.stringify({
    changedFields: fields.sort(),
    versionFrom: patch.version,
    versionTo: patch.version + 1,
  });
  const update = db.prepare(updateSql).bind(...values, id, patch.version);
  const audit = db
    .prepare(
      `INSERT INTO admin_audit_log
        (id, admin_email, action, entity_type, entity_id, request_id, details_json)
       SELECT ?, ?, 'update_artwork', 'artwork', ?, ?, ?
       WHERE changes() = 1`,
    )
    .bind(requestId, adminEmail, id, requestId, detailsJson);
  return [update, audit];
}
