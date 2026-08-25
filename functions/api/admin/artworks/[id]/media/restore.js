import { ADMIN_ARTWORK_BY_ID_SQL, mapArtwork, validateArtworkId } from "../../../../../_lib/artworks.js";
import { buildMediaRestoreBatch } from "../../../../../_lib/media.js";
import { adminJson, adminMethodNotAllowed, adminServiceUnavailable } from "../../../../../_lib/http.js";

export async function onRequest(context) {
  if (context.request.method !== "POST") return adminMethodNotAllowed(["POST"]);
  const artworkId = validateArtworkId(context.params?.id);
  if (!artworkId) {
    return adminJson({ error: { code: "INVALID_ARTWORK_ID", message: "Invalid artwork id." } }, { status: 400 });
  }
  try {
    const contentType = context.request.headers.get("content-type")?.split(";", 1)[0].toLowerCase();
    if (contentType !== "application/json") {
      return adminJson({ error: { code: "UNSUPPORTED_MEDIA_TYPE", message: "Content-Type must be application/json." } }, { status: 415 });
    }
    const text = await context.request.text();
    if (new TextEncoder().encode(text).byteLength > 1024) {
      return adminJson({ error: { code: "REQUEST_TOO_LARGE", message: "Request body is too large." } }, { status: 413 });
    }
    let body;
    try { body = JSON.parse(text); } catch { body = null; }
    if (!body || Object.keys(body).some((key) => key !== "version") || !Number.isSafeInteger(body.version) || body.version < 1) {
      return adminJson({ error: { code: "VERSION_REQUIRED", message: "Current artwork version is required." } }, { status: 400 });
    }
    const artwork = await context.env.DB.prepare(`
      SELECT id, version, image_url AS legacyImage, primary_media_id AS primaryMediaId
      FROM artworks WHERE id = ?
    `).bind(artworkId).first();
    if (!artwork) return adminJson({ error: { code: "NOT_FOUND", message: "Artwork not found." } }, { status: 404 });
    if (artwork.version !== body.version) {
      return adminJson({ error: { code: "VERSION_CONFLICT", message: "Artwork was modified by another administrator." } }, { status: 409 });
    }
    const revision = await context.env.DB.prepare(`
      SELECT r.previous_media_id AS previousMediaId, m.object_key AS previousObjectKey
      FROM artwork_media_revisions r
      LEFT JOIN media_assets m ON m.id = r.previous_media_id
      WHERE r.artwork_id = ? AND r.replacement_media_id = ?
      ORDER BY r.version DESC, r.created_at DESC LIMIT 1
    `).bind(artworkId, artwork.primaryMediaId).first();
    if (!revision) {
      return adminJson({ error: { code: "MEDIA_REVISION_NOT_FOUND", message: "No previous image is available." } }, { status: 409 });
    }
    if (revision.previousMediaId) {
      if (!revision.previousObjectKey) {
        return adminJson({ error: { code: "MEDIA_REVISION_BROKEN", message: "Previous image metadata is unavailable." } }, { status: 409 });
      }
      if (!context.env.MEDIA) {
        return adminJson({ error: { code: "MEDIA_STORAGE_NOT_CONFIGURED", message: "Media storage is not configured." } }, { status: 503 });
      }
      const previousObject = await context.env.MEDIA.head(revision.previousObjectKey);
      if (!previousObject) {
        return adminJson({ error: { code: "MEDIA_OBJECT_MISSING", message: "Previous image data is unavailable." } }, { status: 409 });
      }
    }
    const requestId = crypto.randomUUID();
    await context.env.DB.batch(buildMediaRestoreBatch(
      context.env.DB,
      artwork,
      revision,
      context.data.admin.email,
      requestId,
    ));
    const persisted = await context.env.DB.prepare(`
      SELECT primary_media_id AS mediaId, version FROM artworks WHERE id = ?
    `).bind(artworkId).first();
    if (persisted?.mediaId !== revision.previousMediaId || persisted?.version !== body.version + 1) {
      return adminJson({ error: { code: "VERSION_CONFLICT", message: "Artwork was modified by another administrator." } }, { status: 409 });
    }
    const updated = await context.env.DB.prepare(ADMIN_ARTWORK_BY_ID_SQL).bind(artworkId).first();
    if (!updated) return adminServiceUnavailable();
    return adminJson({ artwork: mapArtwork(updated) }, { headers: { "x-request-id": requestId } });
  } catch {
    return adminServiceUnavailable();
  }
}
