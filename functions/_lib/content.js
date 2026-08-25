const MAX_CONTENT_REQUEST_BYTES = 64 * 1024;

export const PROFILE_FIELDS = Object.freeze({
  artistNameZh: ["artist_name_zh", 120, true],
  artistNameEn: ["artist_name_en", 120, true],
  artistBioZh: ["artist_bio_zh", 5000, true],
  artistBioEn: ["artist_bio_en", 5000, true],
  artistStatementZh: ["artist_statement_zh", 1000, true],
  artistStatementEn: ["artist_statement_en", 1000, true],
  heroTitleZh: ["hero_title_zh", 120, true],
  heroTitleEn: ["hero_title_en", 120, true],
  heroTextZh: ["hero_text_zh", 1000, true],
  heroTextEn: ["hero_text_en", 1000, true],
  heroRecordZh: ["hero_record_zh", 500, true],
  heroRecordEn: ["hero_record_en", 500, true],
  contactTextZh: ["contact_text_zh", 2000, true],
  contactTextEn: ["contact_text_en", 2000, true],
  contactProcessZh: ["contact_process_zh", 2000, true],
  contactProcessEn: ["contact_process_en", 2000, true],
  contactInfoTextZh: ["contact_info_text_zh", 1000, true],
  contactInfoTextEn: ["contact_info_text_en", 1000, true],
  activityIntroZh: ["activity_intro_zh", 1000, true],
  activityIntroEn: ["activity_intro_en", 1000, true],
});

const ENTRY_FIELDS = Object.freeze({
  kind: ["kind"],
  yearLabel: ["year_label", 40],
  titleZh: ["title_zh", 300],
  titleEn: ["title_en", 300],
  bodyZh: ["body_zh", 5000],
  bodyEn: ["body_en", 5000],
  sourceUrl: ["source_url", 1000],
  contentStatus: ["content_status"],
  displayOrder: ["display_order"],
});

const PROFILE_SELECT_COLUMNS = Object.entries(PROFILE_FIELDS)
  .map(([field, [column]]) => `${column} AS ${field}`)
  .join(",\n    ");

export const PROFILE_SELECT_SQL = `
  SELECT id,
    ${PROFILE_SELECT_COLUMNS},
    version, created_at AS createdAt, updated_at AS updatedAt
  FROM site_profiles
  WHERE id = 'main'
`;

export const ENTRY_SELECT_SQL = `
  SELECT id, kind, year_label AS yearLabel,
    title_zh AS titleZh, title_en AS titleEn,
    body_zh AS bodyZh, body_en AS bodyEn,
    source_url AS sourceUrl, content_status AS contentStatus,
    display_order AS displayOrder, version,
    created_at AS createdAt, updated_at AS updatedAt
  FROM site_entries
`;

export class ContentInputError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = "ContentInputError";
    this.code = code;
    this.status = status;
  }
}

function invalid(field, message) {
  throw new ContentInputError("INVALID_FIELD", `${field} ${message}.`, 422);
}

function integer(field, value, minimum, maximum) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    invalid(field, `must be an integer between ${minimum} and ${maximum}`);
  }
  return value;
}

function text(field, value, maximum, required = false) {
  if (typeof value !== "string") invalid(field, "must be a string");
  const normalized = value.trim();
  if (required && !normalized) invalid(field, "is required");
  if (normalized.length > maximum) invalid(field, `must be at most ${maximum} characters`);
  return normalized;
}

function enumValue(field, value, allowed) {
  if (!allowed.includes(value)) invalid(field, `must be one of ${allowed.join(", ")}`);
  return value;
}

function sourceUrl(value) {
  const normalized = text("sourceUrl", value, 1000);
  if (!normalized) return "";
  let parsed;
  try {
    parsed = new URL(normalized);
  } catch {
    invalid("sourceUrl", "must be an absolute HTTPS URL or empty");
  }
  if (parsed.protocol !== "https:") invalid("sourceUrl", "must use HTTPS");
  return parsed.toString();
}

async function jsonObject(request) {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    throw new ContentInputError("UNSUPPORTED_MEDIA_TYPE", "Content-Type must be application/json.", 415);
  }
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_CONTENT_REQUEST_BYTES) {
    throw new ContentInputError("REQUEST_TOO_LARGE", "Request body is too large.", 413);
  }
  const bodyText = await request.text();
  if (new TextEncoder().encode(bodyText).byteLength > MAX_CONTENT_REQUEST_BYTES) {
    throw new ContentInputError("REQUEST_TOO_LARGE", "Request body is too large.", 413);
  }
  let body;
  try {
    body = JSON.parse(bodyText);
  } catch {
    throw new ContentInputError("INVALID_JSON", "Request body must be valid JSON.", 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ContentInputError("INVALID_JSON", "Request body must be a JSON object.", 400);
  }
  return body;
}

function requireVersion(body) {
  if (!Object.prototype.hasOwnProperty.call(body, "version")) {
    throw new ContentInputError("VERSION_REQUIRED", "Current version is required.", 400);
  }
  return integer("version", body.version, 1, 2_147_483_647);
}

export async function parseProfilePatch(request) {
  const body = await jsonObject(request);
  const version = requireVersion(body);
  const keys = Object.keys(body);
  if (keys.some((key) => key !== "version" && !PROFILE_FIELDS[key])) {
    throw new ContentInputError("UNKNOWN_FIELD", "Request contains an unsupported field.", 400);
  }
  if (keys.length === 1) {
    throw new ContentInputError("NO_CHANGES", "At least one content field is required.", 400);
  }
  const patch = { version };
  for (const [field, value] of Object.entries(body)) {
    if (field === "version") continue;
    const [, maximum, required] = PROFILE_FIELDS[field];
    patch[field] = text(field, value, maximum, required);
  }
  return patch;
}

function parseEntryFields(body, { creating }) {
  const allowed = new Set([...Object.keys(ENTRY_FIELDS), ...(creating ? [] : ["version"])]);
  if (Object.keys(body).some((key) => !allowed.has(key))) {
    throw new ContentInputError("UNKNOWN_FIELD", "Request contains an unsupported field.", 400);
  }
  const entry = {};
  if (Object.prototype.hasOwnProperty.call(body, "kind")) {
    entry.kind = enumValue("kind", body.kind, ["timeline", "activity", "person", "collaboration"]);
  }
  for (const field of ["yearLabel", "titleZh", "titleEn", "bodyZh", "bodyEn"]) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      entry[field] = text(field, body[field], ENTRY_FIELDS[field][1], field === "bodyZh" || field === "bodyEn");
    }
  }
  if (Object.prototype.hasOwnProperty.call(body, "sourceUrl")) entry.sourceUrl = sourceUrl(body.sourceUrl);
  if (Object.prototype.hasOwnProperty.call(body, "contentStatus")) {
    entry.contentStatus = enumValue("contentStatus", body.contentStatus, ["draft", "published", "archived"]);
  }
  if (Object.prototype.hasOwnProperty.call(body, "displayOrder")) {
    entry.displayOrder = integer("displayOrder", body.displayOrder, 0, 100_000);
  }
  if (creating) {
    for (const field of ["kind", "bodyZh", "bodyEn", "contentStatus", "displayOrder"]) {
      if (!Object.prototype.hasOwnProperty.call(entry, field)) invalid(field, "is required");
    }
    entry.yearLabel ??= "";
    entry.titleZh ??= "";
    entry.titleEn ??= "";
    entry.sourceUrl ??= "";
    if (["activity", "person", "collaboration"].includes(entry.kind) && (!entry.titleZh || !entry.titleEn)) {
      invalid("titleZh/titleEn", "are required for this content type");
    }
  }
  return entry;
}

export async function parseEntryCreate(request) {
  return parseEntryFields(await jsonObject(request), { creating: true });
}

export async function parseEntryPatch(request) {
  const body = await jsonObject(request);
  const version = requireVersion(body);
  const fields = parseEntryFields(body, { creating: false });
  if (!Object.keys(fields).length) {
    throw new ContentInputError("NO_CHANGES", "At least one entry field is required.", 400);
  }
  return { version, ...fields };
}

export async function parseRestoreRequest(request) {
  const body = await jsonObject(request);
  if (Object.keys(body).some((key) => key !== "version")) {
    throw new ContentInputError("UNKNOWN_FIELD", "Request contains an unsupported field.", 400);
  }
  return { version: requireVersion(body) };
}

export function validateContentEntryId(id) {
  if (typeof id !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(id)) return null;
  return id;
}

export function profileFields(profile) {
  return Object.fromEntries(Object.keys(PROFILE_FIELDS).map((field) => [field, profile[field]]));
}

export function entryFields(entry) {
  return Object.fromEntries(Object.keys(ENTRY_FIELDS).map((field) => [field, entry[field]]));
}

export function buildProfileUpdateBatch(db, patch, adminEmail, requestId, current, action = "update_site_profile") {
  const fields = Object.keys(patch).filter((field) => field !== "version");
  const assignments = fields.map((field) => `${PROFILE_FIELDS[field][0]} = ?`);
  const update = db.prepare(`
    UPDATE site_profiles
    SET ${assignments.join(", ")}, version = version + 1,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = 'main' AND version = ?
    RETURNING id
  `).bind(...fields.map((field) => patch[field]), patch.version);
  const revision = db.prepare(`
    INSERT INTO site_content_revisions
      (id, entity_type, entity_id, version, snapshot_json, admin_email, request_id)
    SELECT ?, 'site_profile', 'main', ?, ?, ?, ? WHERE changes() = 1
  `).bind(globalThis.crypto.randomUUID(), current.version, JSON.stringify(profileFields(current)), adminEmail, requestId);
  const audit = db.prepare(`
    INSERT INTO admin_audit_log
      (id, admin_email, action, entity_type, entity_id, request_id, details_json)
    SELECT ?, ?, ?, 'site_profile', 'main', ?, ? WHERE changes() = 1
  `).bind(requestId, adminEmail, action, requestId, JSON.stringify({
    changedFields: fields.sort(), versionFrom: patch.version, versionTo: patch.version + 1,
  }));
  return [update, revision, audit];
}

export function buildEntryUpdateBatch(db, id, patch, adminEmail, requestId, current, action = "update_site_entry") {
  const fields = Object.keys(patch).filter((field) => field !== "version");
  const assignments = fields.map((field) => `${ENTRY_FIELDS[field][0]} = ?`);
  const update = db.prepare(`
    UPDATE site_entries
    SET ${assignments.join(", ")}, version = version + 1,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = ? AND version = ?
    RETURNING id
  `).bind(...fields.map((field) => patch[field]), id, patch.version);
  const revision = db.prepare(`
    INSERT INTO site_content_revisions
      (id, entity_type, entity_id, version, snapshot_json, admin_email, request_id)
    SELECT ?, 'site_entry', ?, ?, ?, ?, ? WHERE changes() = 1
  `).bind(globalThis.crypto.randomUUID(), id, current.version, JSON.stringify(entryFields(current)), adminEmail, requestId);
  const audit = db.prepare(`
    INSERT INTO admin_audit_log
      (id, admin_email, action, entity_type, entity_id, request_id, details_json)
    SELECT ?, ?, ?, 'site_entry', ?, ?, ? WHERE changes() = 1
  `).bind(requestId, adminEmail, action, id, requestId, JSON.stringify({
    changedFields: fields.sort(), versionFrom: patch.version, versionTo: patch.version + 1,
  }));
  return [update, revision, audit];
}

export function buildEntryCreateBatch(db, id, entry, adminEmail, requestId) {
  const insert = db.prepare(`
    INSERT INTO site_entries
      (id, kind, year_label, title_zh, title_en, body_zh, body_en,
       source_url, content_status, display_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING id
  `).bind(id, entry.kind, entry.yearLabel, entry.titleZh, entry.titleEn,
    entry.bodyZh, entry.bodyEn, entry.sourceUrl, entry.contentStatus, entry.displayOrder);
  const audit = db.prepare(`
    INSERT INTO admin_audit_log
      (id, admin_email, action, entity_type, entity_id, request_id, details_json)
    SELECT ?, ?, 'create_site_entry', 'site_entry', ?, ?, ? WHERE changes() = 1
  `).bind(requestId, adminEmail, id, requestId, JSON.stringify({ kind: entry.kind, versionTo: 1 }));
  return [insert, audit];
}
