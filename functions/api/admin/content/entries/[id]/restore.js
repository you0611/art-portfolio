import {
  ContentInputError,
  ENTRY_SELECT_SQL,
  buildEntryUpdateBatch,
  entryFields,
  parseRestoreRequest,
  validateContentEntryId,
} from "../../../../../_lib/content.js";
import { adminJson, adminMethodNotAllowed, adminServiceUnavailable } from "../../../../../_lib/http.js";

function inputError(error) {
  if (error instanceof ContentInputError) {
    return adminJson({ error: { code: error.code, message: error.message } }, { status: error.status });
  }
  return adminServiceUnavailable();
}

export async function onRequest(context) {
  if (context.request.method !== "POST") return adminMethodNotAllowed(["POST"]);
  const id = validateContentEntryId(context.params?.id);
  if (!id) return adminJson({ error: { code: "INVALID_CONTENT_ID", message: "Invalid content id." } }, { status: 400 });
  try {
    const { version } = await parseRestoreRequest(context.request);
    const current = await context.env.DB.prepare(`${ENTRY_SELECT_SQL} WHERE id = ?`).bind(id).first();
    if (!current) return adminJson({ error: { code: "NOT_FOUND", message: "Content entry not found." } }, { status: 404 });
    if (current.version !== version) {
      return adminJson({ error: { code: "VERSION_CONFLICT", message: "Content changed before restore." } }, { status: 409 });
    }
    const revision = await context.env.DB.prepare(`
      SELECT snapshot_json AS snapshotJson
      FROM site_content_revisions
      WHERE entity_type = 'site_entry' AND entity_id = ?
      ORDER BY created_at DESC, rowid DESC
      LIMIT 1
    `).bind(id).first();
    if (!revision) {
      return adminJson({ error: { code: "NO_REVISION", message: "No earlier entry version is available." } }, { status: 404 });
    }
    const patch = { version, ...entryFields(JSON.parse(revision.snapshotJson)) };
    const requestId = globalThis.crypto.randomUUID();
    await context.env.DB.batch(buildEntryUpdateBatch(
      context.env.DB, id, patch, context.data.admin.email, requestId, current, "restore_site_entry",
    ));
    const updated = await context.env.DB.prepare(`${ENTRY_SELECT_SQL} WHERE id = ?`).bind(id).first();
    if (!updated || updated.version !== version + 1) {
      return adminJson({ error: { code: "VERSION_CONFLICT", message: "Content changed before restore." } }, { status: 409 });
    }
    return adminJson({ entry: updated }, { headers: { "x-request-id": requestId } });
  } catch (error) {
    return inputError(error);
  }
}
