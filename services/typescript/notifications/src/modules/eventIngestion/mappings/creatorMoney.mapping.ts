import { formatMoney } from "@zudomart/email-templates";

import type { MoneyValue } from "../../../utils/eventDataReader.util.js";
import { intentFor, type EventMapping } from "./mappingHelpers.js";

const amountText = (money: MoneyValue | undefined) => (money === undefined ? "" : ` ${formatMoney(money, "en-NG")}`);

export const creatorSubscriptionStarted: EventMapping = (event, data) => {
  const share = data.optionalMoney("creatorShare");
  const body = share === undefined ? "Someone just subscribed to you." : `Someone just subscribed to you. You earn${amountText(share)} from this payment.`;
  return [
    intentFor(event, data.text("creatorId"), {
      category: "creator",
      inApp: { category: "system", title: "New subscriber", body, data: { url: "/creator", screen: "CreatorSubscribers" } },
      push: { title: "New subscriber", body: "Someone just subscribed to you.", data: { url: "/creator", screen: "CreatorSubscribers" } },
    }),
  ];
};

export const tipSent: EventMapping = (event, data) => {
  const coins = data.integer("coins", 0);
  const where = data.text("targetType", "post") === "live" ? "your live" : `your ${data.text("targetType", "post")}`;
  const body = coins > 0 ? `Someone tipped ${coins} coins on ${where}.` : `Someone tipped you on ${where}.`;
  return [
    intentFor(event, data.text("creatorUserId"), {
      category: "creator",
      inApp: { category: "social", title: "You got a tip", body, data: { url: "/creator", screen: "CreatorEarnings" } },
      push: { title: "You got a tip", body, data: { url: "/creator", screen: "CreatorEarnings" } },
    }),
  ];
};

export const affiliateCommissionCredited: EventMapping = (event, data) => {
  const body = `You earned${amountText(data.optionalMoney("commission"))} commission on a sale you referred.`;
  return [
    intentFor(event, data.text("creatorId"), {
      category: "creator",
      inApp: { category: "orders", title: "Affiliate commission earned", body, data: { url: "/creator", screen: "CreatorEarnings", orderId: data.text("orderId", "") } },
      push: { title: "Affiliate commission earned", body, data: { url: "/creator", screen: "CreatorEarnings" } },
    }),
  ];
};
