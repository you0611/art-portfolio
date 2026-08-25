import {
  ContentInputError,
  PROFILE_SELECT_SQL,
  buildProfileUpdateBatch,
  parseProfilePatch,
} from "../../../_lib/content.js";
import { adminJson, adminMethodNotAllowed, adminServiceUnavailable } from "../../../_lib/http.js";

function inputError(error) {
  if (error instanceof ContentInputError) {
    return adminJson({ error: { code: error.code, message: error.message } }, { status: error.status });
  }
  return adminServiceUnavailable();
}

export async function onRequest(context) {
  if (context.request.method !== "PATCH") return adminMethodNotAllowed(["PATCH"]);
  try {
    const patch = await parseProfilePatch(context.request);
    const current = await context.env.DB.prepare(PROFILE_SELECT_SQL).first();
    if (!current) return adminServiceUnavailable();
    if (current.version !== patch.version) {
      return adminJson(
        { error: { code: "VERSION_CONFLICT", message: "Content was modified by another administrator." } },
        { status: 409 },
      );
    }
    const id = globalThis.crypto.randomUUID();
    await context.env.DB.batch(buildProfileUpdateBatch(context.env.DB, patch, context.data.admin.email, id, current));
    const updated = await context.env.DB.prepare(PROFILE_SELECT_SQL).first();
    if (!updated || updated.version !== patch.version + 1) {
      return adminJson(
        { error: { code: "VERSION_CONFLICT", message: "Content was modified by another administrator." } },
        { status: 409 },
      );
    }
    return adminJson({ profile: updated }, { headers: { "x-request-id": id } });
  } catch (error) {
    return inputError(error);
  }
}
