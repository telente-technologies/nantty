import { sendAdminApiRequest } from "@/services/adminApiClient.service";
import type { LogisticsShipmentPage, LogisticsShipmentStatus } from "@/types/logistics.type";

export function fetchLogisticsShipments(filters: { readonly status?: LogisticsShipmentStatus; readonly cursor?: string }, signal?: AbortSignal): Promise<LogisticsShipmentPage> {
  return sendAdminApiRequest("/admin/logistics/shipments", { query: { ...filters, limit: 25 }, signal });
}
