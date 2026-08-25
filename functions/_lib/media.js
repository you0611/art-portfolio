import { ArtworkInputError, validateArtworkId } from "./artworks.js";

export const MAX_MEDIA_BYTES = 10 * 1024 * 1024;
export const MAX_MEDIA_REQUEST_BYTES = MAX_MEDIA_BYTES + 64 * 1024;
export const MAX_MEDIA_SIDE = 12_000;
export const MAX_MEDIA_PIXELS = 60_000_000;

const TYPES = Object.freeze({
  "image/jpeg": { extension: "jpg", signature: [0xff, 0xd8, 0xff] },
  "image/png": { extension: "png", signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  "image/webp": { extension: "webp" },
});

export class MediaInputError extends Error {
  constructor(code, message, status = 422) {
    super(message);
    this.name = "MediaInputError";
    this.code = code;
    this.status = status;
  }
}

function matches(bytes, signature, offset = 0) {
  return signature.every((value, index) => bytes[offset + index] === value);
}

function readU24LE(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function jpegDimensions(bytes) {
  if (!matches(bytes, TYPES["image/jpeg"].signature)) return null;
  const sofMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  let offset = 2;
  while (offset + 8 < bytes.length) {
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset++];
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.length) return null;
    const length = (bytes[offset] << 8) | bytes[offset + 1];
    if (length < 2 || offset + length > bytes.length) return null;
    if (sofMarkers.has(marker) && length >= 7) {
      return {
        height: (bytes[offset + 3] << 8) | bytes[offset + 4],
        width: (bytes[offset + 5] << 8) | bytes[offset + 6],
      };
    }
    offset += length;
  }
  return null;
}

function pngDimensions(bytes) {
  if (
    bytes.length < 29 ||
    !matches(bytes, TYPES["image/png"].signature) ||
    !matches(bytes, [0x49, 0x48, 0x44, 0x52], 12)
  ) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (
    view.getUint32(8) !== 13 ||
    ![1, 2, 4, 8, 16].includes(bytes[24]) ||
    ![0, 2, 3, 4, 6].includes(bytes[25]) ||
    bytes[26] !== 0 ||
    bytes[27] !== 0 ||
    ![0, 1].includes(bytes[28])
  ) return null;
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function webpDimensions(bytes) {
  if (bytes.length < 30 || !matches(bytes, [0x52, 0x49, 0x46, 0x46]) || !matches(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return null;
  const chunk = String.fromCharCode(...bytes.slice(12, 16));
  if (chunk === "VP8X") {
    return { width: readU24LE(bytes, 24) + 1, height: readU24LE(bytes, 27) + 1 };
  }
  if (chunk === "VP8 " && matches(bytes, [0x9d, 0x01, 0x2a], 23)) {
    return {
      width: (bytes[26] | (bytes[27] << 8)) & 0x3fff,
      height: (bytes[28] | (bytes[29] << 8)) & 0x3fff,
    };
  }
  if (chunk === "VP8L" && bytes[20] === 0x2f && bytes.length >= 25) {
    return {
      width: 1 + bytes[21] + ((bytes[22] & 0x3f) << 8),
      height: 1 + (bytes[22] >> 6) + (bytes[23] << 2) + ((bytes[24] & 0x0f) << 10),
    };
  }
  return null;
}

function dimensionsFor(type, bytes) {
  if (type === "image/jpeg") return jpegDimensions(bytes);
  if (type === "image/png") return pngDimensions(bytes);
  if (type === "image/webp") return webpDimensions(bytes);
  return null;
}

function safeFilename(name) {
  const value = String(name || "image").split(/[\\/]/).pop().trim();
  return value.slice(0, 255) || "image";
}

async function readLimitedRequestBody(request) {
  if (!request.body) throw new MediaInputError("INVALID_MEDIA_FORM", "Upload form is invalid.", 400);
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_MEDIA_REQUEST_BYTES) {
      await reader.cancel();
      throw new MediaInputError("MEDIA_TOO_LARGE", "Image must be 10 MB or smaller.", 413);
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export async function parseMediaUpload(request) {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_MEDIA_REQUEST_BYTES) {
    throw new MediaInputError("MEDIA_TOO_LARGE", "Image must be 10 MB or smaller.", 413);
  }
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data;")) {
    throw new MediaInputError("UNSUPPORTED_MEDIA_TYPE", "Content-Type must be multipart/form-data.", 415);
  }

  let form;
  try {
    const body = await readLimitedRequestBody(request);
    form = await new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body,
    }).formData();
  } catch (error) {
    if (error instanceof MediaInputError) throw error;
    throw new MediaInputError("INVALID_MEDIA_FORM", "Upload form is invalid.", 400);
  }
  if (
    [...form.keys()].some((key) => !["file", "version"].includes(key)) ||
    form.getAll("file").length !== 1 ||
    form.getAll("version").length !== 1
  ) {
    throw new MediaInputError("UNKNOWN_MEDIA_FIELD", "Upload form contains an unsupported field.", 400);
  }
  const version = Number(form.get("version"));
  if (!Number.isSafeInteger(version) || version < 1 || version > 2_147_483_647) {
    throw new MediaInputError("VERSION_REQUIRED", "Current artwork version is required.", 400);
  }
  const file = form.get("file");
  if (!file || typeof file.arrayBuffer !== "function" || typeof file.size !== "number") {
    throw new MediaInputError("MEDIA_FILE_REQUIRED", "Choose an image to upload.", 400);
  }
  if (file.size < 1 || file.size > MAX_MEDIA_BYTES) {
    throw new MediaInputError("MEDIA_TOO_LARGE", "Image must be 10 MB or smaller.", 413);
  }
  const declaredType = String(file.type || "").toLowerCase();
  const type = TYPES[declaredType];
  if (!type) throw new MediaInputError("MEDIA_TYPE_NOT_ALLOWED", "Use a JPEG, PNG, or WebP image.");

  const buffer = await file.arrayBuffer();
  if (buffer.byteLength !== file.size || buffer.byteLength > MAX_MEDIA_BYTES) {
    throw new MediaInputError("MEDIA_TOO_LARGE", "Image must be 10 MB or smaller.", 413);
  }
  const bytes = new Uint8Array(buffer);
  if (type.signature && !matches(bytes, type.signature)) {
    throw new MediaInputError("MEDIA_SIGNATURE_MISMATCH", "File contents do not match the selected image type.");
  }
  const dimensions = dimensionsFor(declaredType, bytes);
  if (!dimensions || dimensions.width < 64 || dimensions.height < 64) {
    throw new MediaInputError("MEDIA_DIMENSIONS_INVALID", "Image dimensions could not be verified or are too small.");
  }
  if (
    dimensions.width > MAX_MEDIA_SIDE ||
    dimensions.height > MAX_MEDIA_SIDE ||
    dimensions.width * dimensions.height > MAX_MEDIA_PIXELS
  ) {
    throw new MediaInputError("MEDIA_DIMENSIONS_TOO_LARGE", "Image dimensions exceed the safe limit.");
  }
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  const sha256 = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
  return {
    buffer,
    byteSize: buffer.byteLength,
    width: dimensions.width,
    height: dimensions.height,
    mimeType: declaredType,
    extension: type.extension,
    originalFilename: safeFilename(file.name),
    sha256,
    version,
  };
}

export function validateMediaId(id) {
  return typeof id === "string" && /^media-[0-9a-f-]{36}$/.test(id) ? id : null;
}

export function mediaUrl(id) {
  return `/api/media/${id}`;
}

export function mediaObjectKey(artworkId, mediaId, extension) {
  const safeArtworkId = validateArtworkId(artworkId);
  if (!safeArtworkId || !validateMediaId(mediaId) || !["jpg", "png", "webp"].includes(extension)) {
    throw new ArtworkInputError("INVALID_MEDIA_KEY", "Media object key is invalid.", 400);
  }
  return `artworks/${safeArtworkId}/${mediaId}.${extension}`;
}

function stateExistsSql() {
  return `EXISTS (
    SELECT 1 FROM artworks
    WHERE id = ? AND primary_media_id IS ? AND version = ?
  )`;
}

export function buildMediaReplaceBatch(db, artwork, media, adminEmail, requestId) {
  const nextVersion = artwork.version + 1;
  const stateArgs = [artwork.id, media.id, nextVersion];
  const update = db.prepare(`
    UPDATE artworks
    SET primary_media_id = ?, version = version + 1,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = ? AND version = ?
  `).bind(media.id, artwork.id, artwork.version);
  const insert = db.prepare(`
    INSERT INTO media_assets
      (id, artwork_id, object_key, original_filename, mime_type, byte_size,
       width, height, sha256, status, created_by)
    SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?
    WHERE ${stateExistsSql()}
  `).bind(
    media.id, artwork.id, media.objectKey, media.originalFilename, media.mimeType,
    media.byteSize, media.width, media.height, media.sha256, adminEmail,
    ...stateArgs,
  );
  const archivePrevious = db.prepare(`
    UPDATE media_assets SET status = 'archived'
    WHERE id = ? AND ${stateExistsSql()}
  `).bind(artwork.primaryMediaId, ...stateArgs);
  const revision = db.prepare(`
    INSERT INTO artwork_media_revisions
      (id, artwork_id, version, previous_media_id, previous_image_url,
       replacement_media_id, admin_email, request_id)
    SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE ${stateExistsSql()}
  `).bind(
    `revision-${crypto.randomUUID()}`, artwork.id, artwork.version,
    artwork.primaryMediaId, artwork.legacyImage, media.id, adminEmail, requestId,
    ...stateArgs,
  );
  const audit = db.prepare(`
    INSERT INTO admin_audit_log
      (id, admin_email, action, entity_type, entity_id, request_id, details_json)
    SELECT ?, ?, 'replace_artwork_media', 'artwork', ?, ?, ? WHERE ${stateExistsSql()}
  `).bind(
    requestId, adminEmail, artwork.id, requestId,
    JSON.stringify({
      mediaId: media.id,
      previousMediaId: artwork.primaryMediaId,
      versionFrom: artwork.version,
      versionTo: nextVersion,
    }),
    ...stateArgs,
  );
  return [update, insert, archivePrevious, revision, audit];
}

export function buildMediaRestoreBatch(db, artwork, revision, adminEmail, requestId) {
  const nextVersion = artwork.version + 1;
  const restoredId = revision.previousMediaId;
  const stateArgs = [artwork.id, restoredId, nextVersion];
  const update = db.prepare(`
    UPDATE artworks
    SET primary_media_id = ?, version = version + 1,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = ? AND version = ? AND primary_media_id = ?
  `).bind(restoredId, artwork.id, artwork.version, artwork.primaryMediaId);
  const activatePrevious = db.prepare(`
    UPDATE media_assets SET status = 'active'
    WHERE id = ? AND ? IS NOT NULL AND ${stateExistsSql()}
  `).bind(restoredId, restoredId, ...stateArgs);
  const archiveCurrent = db.prepare(`
    UPDATE media_assets SET status = 'archived'
    WHERE id = ? AND ${stateExistsSql()}
  `).bind(artwork.primaryMediaId, ...stateArgs);
  const audit = db.prepare(`
    INSERT INTO admin_audit_log
      (id, admin_email, action, entity_type, entity_id, request_id, details_json)
    SELECT ?, ?, 'restore_artwork_media', 'artwork', ?, ?, ? WHERE ${stateExistsSql()}
  `).bind(
    requestId, adminEmail, artwork.id, requestId,
    JSON.stringify({
      mediaIdFrom: artwork.primaryMediaId,
      mediaIdTo: restoredId,
      versionFrom: artwork.version,
      versionTo: nextVersion,
    }),
    ...stateArgs,
  );
  return [update, activatePrevious, archiveCurrent, audit];
}
