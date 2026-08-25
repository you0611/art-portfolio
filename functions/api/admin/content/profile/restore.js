import {
  ContentInputError,
  PROFILE_SELECT_SQL,
  buildProfileUpdateBatch,
  parseRestoreRequest,
  profileFields,
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
    const { version } = await parseRestoreRequest(context.request);
    const current = await context.env.DB.prepare(PROFILE_SELECT_SQL).first();
    if (!current) return adminServiceUnavailable();
    if (current.version !== version) {
      return adminJson({ error: { code: "VERSION_CONFLICT", message: "Content changed before restore." } }, { status: 409 });
    }
    const revision = await context.env.DB.prepare(`
      SELECT snapshot_json AS snapshotJson
      FROM site_content_revisions
      WHERE entity_type = 'site_profile' AND entity_id = 'main'
      ORDER BY created_at DESC, rowid DESC
      LIMIT 1
    `).first();
    if (!revision) {
      return adminJson({ error: { code: "NO_REVISION", message: "No earlier profile version is available." } }, { status: 404 });
    }
    const snapshot = JSON.parse(revision.snapshotJson);
    const patch = { version, ...profileFields(snapshot) };
    const id = globalThis.crypto.randomUUID();
    await context.env.DB.batch(buildProfileUpdateBatch(
      context.env.DB, patch, context.data.admin.email, id, current, "restore_site_profile",
    ));
    const updated = await context.env.DB.prepare(PROFILE_SELECT_SQL).first();
    if (!updated || updated.version !== version + 1) {
      return adminJson({ error: { code: "VERSION_CONFLICT", message: "Content changed before restore." } }, { status: 409 });
    }
    return adminJson({ profile: updated }, { headers: { "x-request-id": id } });
  } catch (error) {
    return inputError(error);
  }
}
