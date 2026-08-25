import { json, methodNotAllowed, serviceUnavailable } from "../../_lib/http.js";

const PUBLIC_ARTWORKS_SQL = `
  SELECT
    a.id, a.title_zh AS titleZh, a.title_en AS titleEn, a.category,
    a.medium, a.dimensions, a.year,
    CASE WHEN m.id IS NULL THEN a.image_url ELSE '/api/media/' || m.id END AS image,
    a.description_zh AS descriptionZh, a.description_en AS descriptionEn,
    a.detail_path_zh AS detailPathZh, a.detail_path_en AS detailPathEn,
    a.sale_status AS saleStatus, a.display_order AS displayOrder
  FROM artworks a
  LEFT JOIN media_assets m ON m.id = a.primary_media_id AND m.status = 'active'
  WHERE a.content_status = 'published'
  ORDER BY a.display_order ASC, a.id ASC
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
