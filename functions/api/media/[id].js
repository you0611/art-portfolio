import { validateMediaId } from "../../_lib/media.js";
import { json, methodNotAllowed, serviceUnavailable } from "../../_lib/http.js";

export async function onRequest(context) {
  if (context.request.method !== "GET" && context.request.method !== "HEAD") {
    return methodNotAllowed(["GET", "HEAD"]);
  }
  const id = validateMediaId(context.params?.id);
  if (!id) return json({ error: { code: "NOT_FOUND", message: "Image not found." } }, { status: 404 });
  if (!context.env.MEDIA) return serviceUnavailable();
  try {
    const media = await context.env.DB.prepare(`
      SELECT m.object_key AS objectKey, m.mime_type AS mimeType, m.sha256
      FROM media_assets m
      JOIN artworks a ON a.primary_media_id = m.id
      WHERE m.id = ? AND m.status = 'active' AND a.content_status = 'published'
    `).bind(id).first();
    if (!media) return json({ error: { code: "NOT_FOUND", message: "Image not found." } }, { status: 404 });
    const object = await context.env.MEDIA.get(media.objectKey);
    if (!object) return json({ error: { code: "NOT_FOUND", message: "Image not found." } }, { status: 404 });
    const headers = new Headers({
      "cache-control": "public, max-age=31536000, immutable",
      "content-type": media.mimeType,
      "content-disposition": "inline",
      "x-content-type-options": "nosniff",
      etag: object.httpEtag || `"${media.sha256}"`,
    });
    if (context.request.method === "HEAD") return new Response(null, { headers });
    return new Response(object.body, { headers });
  } catch {
    return serviceUnavailable();
  }
}
