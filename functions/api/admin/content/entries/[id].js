import {
  ContentInputError,
  ENTRY_SELECT_SQL,
  buildEntryUpdateBatch,
  parseEntryPatch,
  validateContentEntryId,
} from "../../../../_lib/content.js";
import { adminJson, adminMethodNotAllowed, adminServiceUnavailable } from "../../../../_lib/http.js";

function inputError(error) {
  if (error instanceof ContentInputError) {
    return adminJson({ error: { code: error.code, message: error.message } }, { status: error.status });
  }
  return adminServiceUnavailable();
}

export async function onRequest(context) {
  if (context.request.method !== "PATCH") return adminMethodNotAllowed(["PATCH"]);
  const id = validateContentEntryId(context.params?.id);
  if (!id) return adminJson({ error: { code: "INVALID_CONTENT_ID", message: "Invalid content id." } }, { status: 400 });
  try {
    const patch = await parseEntryPatch(context.request);
    const current = await context.env.DB.prepare(`${ENTRY_SELECT_SQL} WHERE id = ?`).bind(id).first();
    if (!current) return adminJson({ error: { code: "NOT_FOUND", message: "Content entry not found." } }, { status: 404 });
    if (current.version !== patch.version) {
      return adminJson({ error: { code: "VERSION_CONFLICT", message: "Content changed before save." } }, { status: 409 });
    }
    const requestId = globalThis.crypto.randomUUID();
    await context.env.DB.batch(buildEntryUpdateBatch(context.env.DB, id, patch, context.data.admin.email, requestId, current));
    const updated = await context.env.DB.prepare(`${ENTRY_SELECT_SQL} WHERE id = ?`).bind(id).first();
    if (!updated || updated.version !== patch.version + 1) {
      return adminJson({ error: { code: "VERSION_CONFLICT", message: "Content changed before save." } }, { status: 409 });
    }
    return adminJson({ entry: updated }, { headers: { "x-request-id": requestId } });
  } catch (error) {
    return inputError(error);
  }
}
