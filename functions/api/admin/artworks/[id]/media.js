import { ADMIN_ARTWORK_BY_ID_SQL, mapArtwork, validateArtworkId } from "../../../../_lib/artworks.js";
import {
  MediaInputError,
  buildMediaReplaceBatch,
  mediaObjectKey,
  parseMediaUpload,
} from "../../../../_lib/media.js";
import { adminJson, adminMethodNotAllowed, adminServiceUnavailable } from "../../../../_lib/http.js";

async function removeUncommittedObject(bucket, key) {
  try {
    await bucket.delete(key);
  } catch (error) {
    console.error("media_cleanup_failed", { objectKey: key, message: error?.message || "unknown" });
  }
}

export async function onRequest(context) {
  if (context.request.method !== "POST") return adminMethodNotAllowed(["POST"]);
  const artworkId = validateArtworkId(context.params?.id);
  if (!artworkId) {
    return adminJson({ error: { code: "INVALID_ARTWORK_ID", message: "Invalid artwork id." } }, { status: 400 });
  }
  if (!context.env.MEDIA) {
    return adminJson(
      { error: { code: "MEDIA_STORAGE_NOT_CONFIGURED", message: "Media storage is not configured." } },
      { status: 503 },
    );
  }

  let objectKey = "";
  let committed = false;
  try {
    const upload = await parseMediaUpload(context.request);
    const row = await context.env.DB.prepare(`
      SELECT id, version, image_url AS legacyImage, primary_media_id AS primaryMediaId
      FROM artworks WHERE id = ?
    `).bind(artworkId).first();
    if (!row) return adminJson({ error: { code: "NOT_FOUND", message: "Artwork not found." } }, { status: 404 });
    if (row.version !== upload.version) {
      return adminJson(
        { error: { code: "VERSION_CONFLICT", message: "Artwork was modified by another administrator." } },
        { status: 409 },
      );
    }

    const mediaId = `media-${crypto.randomUUID()}`;
    const requestId = crypto.randomUUID();
    objectKey = mediaObjectKey(artworkId, mediaId, upload.extension);
    await context.env.MEDIA.put(objectKey, upload.buffer, {
      httpMetadata: { contentType: upload.mimeType },
      customMetadata: { artworkId, mediaId, sha256: upload.sha256 },
    });
    const media = { ...upload, id: mediaId, objectKey };
    await context.env.DB.batch(buildMediaReplaceBatch(
      context.env.DB,
      row,
      media,
      context.data.admin.email,
      requestId,
    ));
    const persisted = await context.env.DB.prepare(`
      SELECT primary_media_id AS mediaId, version FROM artworks WHERE id = ?
    `).bind(artworkId).first();
    committed = persisted?.mediaId === mediaId && persisted?.version === upload.version + 1;
    if (!committed) {
      await removeUncommittedObject(context.env.MEDIA, objectKey);
      return adminJson(
        { error: { code: "VERSION_CONFLICT", message: "Artwork was modified by another administrator." } },
        { status: 409 },
      );
    }
    const updated = await context.env.DB.prepare(ADMIN_ARTWORK_BY_ID_SQL).bind(artworkId).first();
    if (!updated) return adminServiceUnavailable();
    return adminJson({ artwork: mapArtwork(updated) }, {
      status: 201,
      headers: { "x-request-id": requestId },
    });
  } catch (error) {
    if (objectKey && !committed) await removeUncommittedObject(context.env.MEDIA, objectKey);
    if (error instanceof MediaInputError) {
      return adminJson({ error: { code: error.code, message: error.message } }, { status: error.status });
    }
    return adminServiceUnavailable();
  }
}
