import { json, methodNotAllowed, serviceUnavailable } from "../../_lib/http.js";

const PUBLIC_ARTWORKS_SQL = `
  SELECT
    id, title_zh AS titleZh, title_en AS titleEn, category,
    medium, dimensions, year, image_url AS image,
    description_zh AS descriptionZh, description_en AS descriptionEn,
    detail_path_zh AS detailPathZh, detail_path_en AS detailPathEn,
    sale_status AS saleStatus, display_order AS displayOrder
  FROM artworks
  WHERE content_status = 'published'
  ORDER BY display_order ASC, id ASC
`;

export async function onRequest(context) {
  if (context.request.method !== "GET") return methodNotAllowed(["GET"]);

  try {
    const result = await context.env.DB.prepare(PUBLIC_ARTWORKS_SQL).all();
    return json(
      { artworks: result.results || [] },
      { headers: { "cache-control": "public, max-age=60, stale-while-revalidate=300" } },
    );
  } catch {
    return serviceUnavailable();
  }
}
