import { readMockDatabase } from "@/mocks/mockDatabase.mock";
import type { DashboardActivityEntry, DashboardAlert, DashboardLowStockAlert } from "@/types/dashboard.type";

export function listDashboardActivityEntries(limit: number): DashboardActivityEntry[] {
  const { onlineOrders, disputes, returnRequests, auditLog } = readMockDatabase();
  const entries: DashboardActivityEntry[] = [];
  for (const order of onlineOrders.slice(0, 40)) {
    entries.push({ id: `placed_${order.id}`, kind: "order_placed", summary: `${order.buyer.name} placed order ${order.orderNumber} in the app`, actorName: `@${order.buyer.username}`, href: `/orders/${order.id}`, createdAt: order.createdAt });
    if (order.fulfilment) entries.push({ id: `shipped_${order.id}`, kind: "order_shipped", summary: `Order ${order.orderNumber} shipped with ${order.fulfilment.courier}`, actorName: null, href: `/orders/${order.id}`, createdAt: order.fulfilment.shippedAt });
    if (order.deliveredAt) entries.push({ id: `delivered_${order.id}`, kind: "order_delivered", summary: `${order.buyer.name} received order ${order.orderNumber}`, actorName: null, href: `/orders/${order.id}`, createdAt: order.deliveredAt });
  }
  for (const dispute of disputes) entries.push({ id: `dispute_${dispute.id}`, kind: "dispute_opened", summary: `${dispute.buyerName} opened a dispute on ${dispute.orderNumber}: ${dispute.reason}`, actorName: null, href: `/orders/disputes/${dispute.id}`, createdAt: dispute.openedAt });
  for (const request of returnRequests) entries.push({ id: `return_${request.id}`, kind: "return_requested", summary: `${request.buyerName} asked to return items from ${request.orderNumber}`, actorName: null, href: "/orders/returns", createdAt: request.createdAt });
  for (const auditEntry of auditLog.slice(0, 30)) entries.push({ id: `audit_${auditEntry.id}`, kind: "team_action", summary: auditEntry.summary, actorName: auditEntry.actor.name, href: null, createdAt: auditEntry.createdAt });
  const now = Date.now();
  return entries
    .filter((entry) => new Date(entry.createdAt).getTime() <= now)
    .sort((first, second) => second.createdAt.localeCompare(first.createdAt))
    .slice(0, limit);
}

function estimateUnansweredMessagesCount(): number {
  const { onlineOrders } = readMockDatabase();
  const threeDaysAgo = Date.now() - 3 * 86_400_000;
  const recentBuyers = new Set(onlineOrders.filter((order) => new Date(order.createdAt).getTime() >= threeDaysAgo).map((order) => order.buyer.id));
  return Math.round(recentBuyers.size * 0.35);
}

export function listDashboardAlerts(lowStockAlerts: readonly DashboardLowStockAlert[], outOfStockCount: number, lowStockCount: number): DashboardAlert[] {
  const { onlineOrders, disputes, returnRequests } = readMockDatabase();
  const ordersToAccept = onlineOrders.filter((order) => order.status === "new").length;
  const disputesAwaiting = disputes.filter((dispute) => dispute.status === "awaiting_seller" || dispute.status === "open").length;
  const returnsRequested = returnRequests.filter((request) => request.status === "requested").length;
  const unansweredMessages = estimateUnansweredMessagesCount();
  const alerts: DashboardAlert[] = [];
  if (ordersToAccept > 0) alerts.push({ kind: "orders_to_accept", severity: "caution", count: ordersToAccept, title: `${ordersToAccept} new ${ordersToAccept === 1 ? "order" : "orders"} to accept`, description: "Customers paid in the app. Accept and start packing.", href: "/orders?status=new" });
  if (disputesAwaiting > 0) alerts.push({ kind: "disputes_awaiting_response", severity: "error", count: disputesAwaiting, title: `${disputesAwaiting} ${disputesAwaiting === 1 ? "dispute needs" : "disputes need"} your reply`, description: "Escrow stays on hold until the dispute is settled.", href: "/orders/disputes" });
  if (returnsRequested > 0) alerts.push({ kind: "returns_requested", severity: "caution", count: returnsRequested, title: `${returnsRequested} return ${returnsRequested === 1 ? "request" : "requests"}`, description: "Approve or decline so buyers know what happens next.", href: "/orders/returns" });
  if (outOfStockCount > 0) alerts.push({ kind: "out_of_stock", severity: "error", count: outOfStockCount, title: `${outOfStockCount} ${outOfStockCount === 1 ? "item is" : "items are"} out of stock`, description: lowStockAlerts[0] ? `Including ${lowStockAlerts[0].productName}. Buyers cannot order these.` : "Buyers cannot order these.", href: "/inventory?lowStockOnly=true" });
  if (lowStockCount > outOfStockCount) alerts.push({ kind: "low_stock", severity: "info", count: lowStockCount - outOfStockCount, title: `${lowStockCount - outOfStockCount} running low`, description: "At or below their reorder level.", href: "/inventory?lowStockOnly=true" });
  if (unansweredMessages > 0) alerts.push({ kind: "unanswered_messages", severity: "info", count: unansweredMessages, title: `${unansweredMessages} unanswered ${unansweredMessages === 1 ? "message" : "messages"}`, description: "Quick replies help buyers decide.", href: "/messages?filter=unread" });
  return alerts;
}
