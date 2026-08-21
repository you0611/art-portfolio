import { json, methodNotAllowed, serviceUnavailable } from "../../../_lib/http.js";

const ADMIN_ARTWORKS_SQL = `
  SELECT
    id, title_zh AS titleZh, title_en AS titleEn, category,
    medium, dimensions, year, image_url AS image,
    content_status AS contentStatus, sale_status AS saleStatus,
    price_minor AS priceMinor, currency, price_visibility AS priceVisibility,
    negotiation_enabled AS negotiationEnabled, display_order AS displayOrder,
    version, created_at AS createdAt, updated_at AS updatedAt
  FROM artworks
  ORDER BY display_order ASC, id ASC
`;

export async function onRequest(context) {
  if (context.request.method !== "GET") return methodNotAllowed(["GET"]);

  try {
    const result = await context.env.DB.prepare(ADMIN_ARTWORKS_SQL).all();
    return json(
      { artworks: result.results || [] },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return serviceUnavailable();
  }
}
