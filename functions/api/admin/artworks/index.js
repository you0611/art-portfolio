import { ADMIN_ARTWORKS_SQL, mapArtwork } from "../../../_lib/artworks.js";
import { adminJson, adminMethodNotAllowed, adminServiceUnavailable } from "../../../_lib/http.js";

export async function onRequest(context) {
  if (context.request.method !== "GET") return adminMethodNotAllowed(["GET"]);

  try {
    const result = await context.env.DB.prepare(ADMIN_ARTWORKS_SQL).all();
    return adminJson({ artworks: (result.results || []).map(mapArtwork) });
  } catch {
    return adminServiceUnavailable();
  }
}
