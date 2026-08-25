import {
  ContentInputError,
  ENTRY_SELECT_SQL,
  buildEntryCreateBatch,
  parseEntryCreate,
} from "../../../../_lib/content.js";
import { adminJson, adminMethodNotAllowed, adminServiceUnavailable } from "../../../../_lib/http.js";

function inputError(error) {
  if (error instanceof ContentInputError) {
    return adminJson({ error: { code: error.code, message: error.message } }, { status: error.status });
  }
  return adminServiceUnavailable();
}

export async function onRequest(context) {
  if (context.request.method !== "POST") return adminMethodNotAllowed(["POST"]);
  try {
    const entry = await parseEntryCreate(context.request);
    const id = `content-${globalThis.crypto.randomUUID()}`;
    const requestId = globalThis.crypto.randomUUID();
    await context.env.DB.batch(buildEntryCreateBatch(context.env.DB, id, entry, context.data.admin.email, requestId));
    const created = await context.env.DB.prepare(`${ENTRY_SELECT_SQL} WHERE id = ?`).bind(id).first();
    if (!created) return adminServiceUnavailable();
    return adminJson({ entry: created }, { status: 201, headers: { "x-request-id": requestId } });
  } catch (error) {
    return inputError(error);
  }
}
