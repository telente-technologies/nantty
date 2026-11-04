import { requireMockPermission } from "@/mocks/mockGuards.mock";
import { paginateByCursor, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockRoute } from "@/mocks/mockRouter.mock";

const previewShipments = [
  { shipmentId: "shp_preview_1", orderId: "ord_0001", storeId: "store_preview_1", reference: "ZM-24817", provider: "manual", status: "in_transit", trackingNumber: "TEST-TRACK-1234", trackingUrl: "https://carrier.example/track/TEST-TRACK-1234", createdAt: "2026-11-01T10:00:00.000Z", updatedAt: "2026-11-02T12:00:00.000Z", exception: { reason: "delay", status: "open" } },
  { shipmentId: "shp_preview_2", orderId: "ord_0002", storeId: "store_preview_2", reference: "ZM-24790", provider: "manual", status: "delivered", trackingNumber: null, trackingUrl: null, createdAt: "2026-10-28T10:00:00.000Z", updatedAt: "2026-10-30T12:00:00.000Z", exception: null },
  { shipmentId: "shp_preview_3", orderId: "ord_0003", storeId: "store_preview_3", reference: "ZM-24802", provider: "manual", status: "failed", trackingNumber: "TEST-FAIL-5678", trackingUrl: null, createdAt: "2026-11-01T09:00:00.000Z", updatedAt: "2026-11-02T15:00:00.000Z", exception: { reason: "failed_delivery", status: "open" } },
];

export function registerLogisticsMockHandlers(): void {
  registerMockRoute("GET", "/admin/logistics/shipments", (request) => {
    requireMockPermission(request, "logistics:read");
    const status = request.query.get("status");
    const shipments = previewShipments.filter((shipment) => !status || shipment.status === status);
    return respondWithJson(200, paginateByCursor(shipments, request));
  });
}
