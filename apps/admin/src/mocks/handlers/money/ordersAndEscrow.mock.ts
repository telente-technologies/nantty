import { requireMockPermission } from "@/mocks/mockGuards.mock";
import { matchesSearchText, paginateByCursor, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockRoute } from "@/mocks/mockRouter.mock";

import { findMockOrderOrFail, presentOrderDetail, presentOrderSummary } from "./moneyPresenters.mock";
import { readMockMoneyStore, readUserSearchableText } from "./moneyStore.mock";
import { readPageFilterValue } from "./moneyValidation.mock";

export function registerOrderAndEscrowMockHandlers(): void {
  registerMockRoute("GET", "/admin/orders", (request) => {
    requireMockPermission(request, "orders:read", "disputes:resolve", "refunds:issue", "support:tickets");
    const search = request.query.get("search");
    const status = readPageFilterValue(request, "status");
    const currency = readPageFilterValue(request, "currency");
    const orders = readMockMoneyStore()
      .orders.filter((order) => !currency || order.currency === currency)
      .filter((order) => matchesSearchText(search, order.id, order.orderNumber, order.storeName, order.buyerId, order.sellerId, readUserSearchableText(order.buyerId), readUserSearchableText(order.sellerId)))
      .sort((first, second) => second.placedAt.localeCompare(first.placedAt))
      .map(presentOrderSummary)
      .filter((order) => !status || order.status === status);
    return respondWithJson(200, paginateByCursor(orders, request));
  });

  registerMockRoute("GET", "/admin/orders/:orderIdOrNumber", (request) => {
    requireMockPermission(request, "orders:read", "disputes:resolve", "refunds:issue", "support:tickets");
    return respondWithJson(200, presentOrderDetail(findMockOrderOrFail(request.params.orderIdOrNumber ?? "")));
  });
}
