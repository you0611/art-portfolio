import { ENTRY_SELECT_SQL, PROFILE_SELECT_SQL } from "../../../_lib/content.js";
import { adminJson, adminMethodNotAllowed, adminServiceUnavailable } from "../../../_lib/http.js";

export async function onRequest(context) {
  if (context.request.method !== "GET") return adminMethodNotAllowed(["GET"]);
  try {
    const [profile, entries, revisions] = await Promise.all([
      context.env.DB.prepare(PROFILE_SELECT_SQL).first(),
      context.env.DB.prepare(`${ENTRY_SELECT_SQL} ORDER BY kind ASC, display_order ASC, id ASC`).all(),
      context.env.DB.prepare(`
        SELECT entity_type AS entityType, entity_id AS entityId, COUNT(*) AS count
        FROM site_content_revisions
        GROUP BY entity_type, entity_id
      `).all(),
    ]);
    if (!profile) return adminServiceUnavailable();
    const restorable = new Set((revisions.results || []).map((item) => `${item.entityType}:${item.entityId}`));
    return adminJson({
      profile: { ...profile, canRestore: restorable.has("site_profile:main") },
      entries: (entries.results || []).map((entry) => ({
        ...entry,
        canRestore: restorable.has(`site_entry:${entry.id}`),
      })),
    });
  } catch {
    return adminServiceUnavailable();
  }
}
