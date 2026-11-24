import type { EventMapping } from "./mappingHelpers.js";
import { intentFor, plan } from "./mappingHelpers.js";

export const storeCreditEarned: EventMapping = (event, data, context) => {
  const buyerId = data.optionalText("buyerAccountId") ?? data.text("buyerUserId");
  const storeId = data.text("storeId");
  const currency = data.text("currency", "NGN");
  const amountMinor = data.integer("amountMinor", 0);
  if (amountMinor <= 0) return [];

  const balanceMinor = data.integer("balanceMinor", amountMinor);
  const minimumOrderMinor = data.integer("minimumOrderMinor", 0);
  const storeName = data.optionalText("storeName") ?? data.optionalText("sellerName") ?? "this store";
  const storeUrl = data.optionalText("storeUrl") ?? `${context.webBaseUrl.replace(/\/+$/, "")}/stores/${encodeURIComponent(storeId)}`;
  const orderNumber = data.optionalText("orderNumber") ?? data.optionalText("reference") ?? data.optionalText("orderGroupId") ?? "your order";
  const expiresAt = data.optionalText("expiresAt") ?? new Date(Date.parse(event.occurredAt) + 90 * 24 * 60 * 60 * 1000).toISOString();

  return [
    intentFor(event, buyerId, {
      category: "orders",
      inApp: {
        category: "orders",
        title: "Store credit earned",
        body: `You earned store credit from order ${orderNumber} to spend at ${storeName}.`,
        data: { storeId, ...(data.optionalText("orderGroupId") === undefined ? {} : { orderId: data.text("orderGroupId") }) },
      },
      email: (recipient) =>
        plan("storeCreditEarned", {
          firstName: recipient.firstName,
          storeName,
          storeUrl,
          earned: { amountMinor, currency },
          balance: { amountMinor: balanceMinor, currency },
          expiresAt,
          orderNumber,
          ...(minimumOrderMinor > 0 ? { minimumOrder: { amountMinor: minimumOrderMinor, currency } } : {}),
        }),
    }),
  ];
};
