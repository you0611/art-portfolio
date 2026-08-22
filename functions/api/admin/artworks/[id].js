import {
  ADMIN_ARTWORK_BY_ID_SQL,
  ArtworkInputError,
  buildArtworkUpdateBatch,
  mapArtwork,
  parseArtworkPatch,
  validateArtworkId,
} from "../../../_lib/artworks.js";
import { adminJson, adminMethodNotAllowed, adminServiceUnavailable } from "../../../_lib/http.js";

function requestId() {
  return globalThis.crypto.randomUUID();
}

function errorResponse(error) {
  if (error instanceof ArtworkInputError) {
    return adminJson({ error: { code: error.code, message: error.message } }, { status: error.status });
  }
  return adminServiceUnavailable();
}

async function getArtwork(context, id) {
  const row = await context.env.DB.prepare(ADMIN_ARTWORK_BY_ID_SQL).bind(id).first();
  if (!row) return adminJson({ error: { code: "NOT_FOUND", message: "Artwork not found." } }, { status: 404 });
  return adminJson({ artwork: mapArtwork(row) });
}

async function patchArtwork(context, id) {
  const patch = await parseArtworkPatch(context.request);
  const idForRequest = requestId();
  const statements = buildArtworkUpdateBatch(
    context.env.DB,
    id,
    patch,
    context.data.admin.email,
    idForRequest,
  );
  const batchResult = await context.env.DB.batch(statements);
  const updateResult = batchResult?.[0];
  const changed = Number(updateResult?.meta?.changes || 0) === 1;

  if (!changed) {
    const existing = await context.env.DB.prepare("SELECT 1 AS present FROM artworks WHERE id = ?").bind(id).first();
    if (!existing) {
      return adminJson({ error: { code: "NOT_FOUND", message: "Artwork not found." } }, { status: 404 });
    }
    return adminJson(
      { error: { code: "VERSION_CONFLICT", message: "Artwork was modified by another administrator." } },
      { status: 409 },
    );
  }

  let updated = updateResult.results?.[0] || null;
  if (!updated) {
    updated = await context.env.DB.prepare(ADMIN_ARTWORK_BY_ID_SQL).bind(id).first();
  }
  if (!updated) return adminServiceUnavailable();

  return adminJson(
    { artwork: mapArtwork(updated) },
    { headers: { "x-request-id": idForRequest } },
  );
}

export async function onRequest(context) {
  const id = validateArtworkId(context.params?.id);
  if (!id) {
    return adminJson({ error: { code: "INVALID_ARTWORK_ID", message: "Invalid artwork id." } }, { status: 400 });
  }

  try {
    if (context.request.method === "GET") return await getArtwork(context, id);
    if (context.request.method === "PATCH") return await patchArtwork(context, id);
    return adminMethodNotAllowed(["GET", "PATCH"]);
  } catch (error) {
    return errorResponse(error);
  }
}
