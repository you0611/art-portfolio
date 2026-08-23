import { ADMIN_ORDERS_SQL, mapAdminOrder, releaseExpiredInventoryHolds } from "../../../_lib/orders.js";
import { adminJson, adminMethodNotAllowed, adminServiceUnavailable } from "../../../_lib/http.js";

export async function onRequest(context) {
  if (context.request.method !== "GET") return adminMethodNotAllowed(["GET"]);
  try {
    await releaseExpiredInventoryHolds(context.env.DB);
    const result = await context.env.DB.prepare(ADMIN_ORDERS_SQL).all();
    return adminJson({ orders: (result.results || []).map((row) => mapAdminOrder(row)) });
  } catch {
    return adminServiceUnavailable();
  }
}
