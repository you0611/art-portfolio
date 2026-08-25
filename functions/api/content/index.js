import { ENTRY_SELECT_SQL, PROFILE_SELECT_SQL } from "../../_lib/content.js";
import { json, methodNotAllowed, serviceUnavailable } from "../../_lib/http.js";

export async function onRequest(context) {
  if (context.request.method !== "GET") return methodNotAllowed(["GET"]);
  try {
    const [profile, entries] = await Promise.all([
      context.env.DB.prepare(PROFILE_SELECT_SQL).first(),
      context.env.DB.prepare(`${ENTRY_SELECT_SQL}
        WHERE content_status = 'published'
        ORDER BY kind ASC, display_order ASC, id ASC`).all(),
    ]);
    if (!profile) return serviceUnavailable();
    return json(
      { profile, entries: entries.results || [] },
      { headers: { "cache-control": "public, max-age=0, must-revalidate" } },
    );
  } catch {
    return serviceUnavailable();
  }
}
