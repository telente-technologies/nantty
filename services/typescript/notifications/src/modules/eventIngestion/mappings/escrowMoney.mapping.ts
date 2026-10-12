import type { EventDataReader } from "../../../utils/eventDataReader.util.js";
import { readGroups } from "./orders.mapping.js";
import { intentFor, plan, type EventMapping } from "./mappingHelpers.js";

const zeroIn = (currency: string) => ({ amountMinor: 0, currency });

export const escrowHeld: EventMapping = (event, data, context) => [
  intentFor(event, data.text("buyerUserId"), {
    category: "escrow",
    inApp: { category: "orders", title: "Payment held in escrow", body: "Your payment is safe. The seller is preparing your order.", data: { orderId: data.text("orderId"), escrowId: data.text("escrowId") } },
    email: (recipient) => plan("escrowFundsProtected", {
      firstName: recipient.firstName, orderNumber: data.text("orderNumber"), orderUrl: `${context.webBaseUrl}/orders/${data.text("orderId")}`,
      groups: readGroups(data).map((entry) => entry.group), releaseRule: data.text("releaseRule"),
    }),
  }),
];

export const escrowReleased: EventMapping = (event, data) => {
  const gross = data.money("amount");
  return [
    intentFor(event, data.text("sellerUserId"), {
      category: "escrow",
      inApp: { category: "orders", title: "Escrow released", body: "Payment for your order is now in your available balance.", data: { orderId: data.text("orderId"), escrowId: data.text("escrowId") } },
      push: { title: "Escrow released", body: "Funds from an order are now available.", data: { orderId: data.text("orderId") } },
      email: (recipient) => plan("escrowReleased", {
        firstName: recipient.firstName, orderNumber: data.text("orderNumber"), gross, commission: data.money("commission"),
        paymentFee: data.optionalMoney("paymentFee") ?? zeroIn(gross.currency), net: data.money("releasedToSeller"), availableAt: data.text("availableAt", event.occurredAt),
        releasedBecause: ((value) => (value === "auto" || value === "dispute" ? value : "confirmed"))(data.text("releasedBecause", "confirmed")),
      }),
    }),
  ];
};

const refundCopy = {
  wallet: { method: "Your Zudomart wallet", inApp: "The money is back in your Zudomart wallet. You can spend it or withdraw it to your bank.", push: "It's back in your Zudomart wallet." },
  paymentMethod: { method: "The card or account you paid with", inApp: "Your refund is on its way back to the card or account you paid with. Your bank may take 3–5 business days to show it.", push: "It's on its way back to the card or account you paid with." },
} as const;

const refundDestinationOf = (data: EventDataReader) => (data.text("refundDestination", "wallet") === "paymentMethod" ? "paymentMethod" : "wallet");

function refundIntent(partial: boolean): EventMapping {
  return (event, data) => {
    const destination = refundDestinationOf(data);
    const copy = refundCopy[destination];
    const title = partial ? "Partial refund issued" : "Refund issued";
    return [
      intentFor(event, data.text("buyerUserId"), {
        category: "payments",
        inApp: { category: "orders", title, body: copy.inApp, data: { orderId: data.text("orderId"), escrowId: data.text("escrowId") } },
        push: { title, body: copy.push, data: { orderId: data.text("orderId") } },
        email: (recipient) => plan("refundIssued", {
          firstName: recipient.firstName, orderNumber: data.text("orderNumber"), refund: data.money("refunded"), refundDestination: destination, refundMethod: copy.method,
          reference: data.text("escrowId"), reason: data.text("reason", partial ? "Partial refund" : "Order refunded"), itemName: data.text("itemName", "your order"),
        }),
      }),
    ];
  };
}

export const escrowRefundScheduled: EventMapping = (event, data) => {
  const order = data.text("orderNumber", "your order");
  const links = { orderId: data.text("orderId"), escrowId: data.text("escrowId") };
  return [
    intentFor(event, data.text("buyerUserId"), {
      category: "payments",
      inApp: { category: "orders", title: "Refund scheduled", body: `Your refund for order ${order} is scheduled. It completes automatically once your card payment settles, usually within one business day.`, data: links },
    }),
    intentFor(event, data.text("sellerUserId"), {
      category: "escrow",
      inApp: { category: "orders", title: "Refund scheduled", body: `A refund on order ${order} runs once the buyer's card payment settles. The refunded amount won't be released to you.`, data: links },
    }),
  ];
};

export const escrowRefunded = refundIntent(false);
export const escrowPartiallyRefunded = refundIntent(true);

function disputeParties(event: Parameters<EventMapping>[0], data: EventDataReader, build: (role: "buyer" | "seller", userId: string) => Parameters<typeof intentFor>[2]) {
  return [intentFor(event, data.text("buyerUserId"), build("buyer", data.text("buyerUserId"))), intentFor(event, data.text("sellerUserId"), build("seller", data.text("sellerUserId")))];
}

const disputeBase = (data: EventDataReader, firstName: string, role: "buyer" | "seller", webBaseUrl: string) => ({
  firstName, role, caseNumber: data.text("caseNumber"), orderNumber: data.text("orderNumber"), caseUrl: `${webBaseUrl}/disputes/${data.text("disputeId")}`, amount: data.money("amount"),
});

export const disputeOpened: EventMapping = (event, data, context) =>
  disputeParties(event, data, (role) => ({
    category: "escrow", variant: role,
    inApp: { category: "orders", title: "Dispute opened", body: `A dispute was opened on order ${data.text("orderNumber", "your order")}. Respond within 48 hours.`, data: { disputeId: data.text("disputeId"), orderId: data.text("orderId") } },
    push: { title: "Dispute opened", body: "Open the case to respond.", data: { disputeId: data.text("disputeId") } },
    email: (recipient) => plan("disputeOpened", { ...disputeBase(data, recipient.firstName, role, context.webBaseUrl), reason: data.text("reason"), respondBy: data.text("respondBy"), openedBy: data.text("openedBy", "the buyer") }),
  }));

export const disputeMessagePosted: EventMapping = (event, data, context) => {
  const authorIsBuyer = data.text("authorUserId") === data.text("buyerUserId");
  const recipientRole = authorIsBuyer ? "seller" : "buyer";
  const recipientId = data.text(authorIsBuyer ? "sellerUserId" : "buyerUserId");
  return [
    intentFor(event, recipientId, {
      category: "escrow",
      inApp: { category: "orders", title: "Dispute update", body: "There is a new message on your dispute.", data: { disputeId: data.text("disputeId") } },
      push: { title: "Dispute update", body: "There is a new message on your dispute.", data: { disputeId: data.text("disputeId") } },
      email: (recipient) => plan("disputeUpdate", {
        ...disputeBase(data, recipient.firstName, recipientRole, context.webBaseUrl), update: data.text("message"), from: data.text("authorName", authorIsBuyer ? "The buyer" : "The seller"),
        stage: data.integer("stage", 1), ...(data.optionalText("actionNeededBy") === undefined ? {} : { actionNeededBy: data.text("actionNeededBy") }),
      }),
    }),
  ];
};

export const disputeResolved: EventMapping = (event, data, context) =>
  disputeParties(event, data, (role) => ({
    category: "escrow", variant: role,
    inApp: { category: "orders", title: "Dispute resolved", body: `The dispute on order ${data.text("orderNumber", "your order")} has been resolved.`, data: { disputeId: data.text("disputeId") } },
    email: (recipient) => plan("disputeResolved", {
      ...disputeBase(data, recipient.firstName, role, context.webBaseUrl),
      outcome: ((value) => (value === "refund_partial" || value === "release_seller" ? value : "refund_full"))(data.text("outcome")),
      buyerRefund: data.money("buyerRefund"), sellerPayout: data.money("sellerPayout"), summary: data.text("summary"),
    }),
  }));

export const disputeSellerResponseOverdue: EventMapping = (event, data) =>
  disputeParties(event, data, (role) => ({
    category: "escrow", variant: role,
    inApp: {
      category: "orders", title: "Dispute sent to Zudomart review",
      body: role === "seller" ? "You didn't respond within 48 hours, so our team is now reviewing the dispute. You can still add your side." : "The seller didn't respond within 48 hours, so our team is now reviewing your dispute. Your money stays protected.",
      data: { disputeId: data.text("disputeId"), orderId: data.text("orderId") },
    },
    push: { title: "Dispute under review", body: "The 48-hour response window ended. Zudomart support is reviewing the case.", data: { disputeId: data.text("disputeId") } },
  }));

export const paymentFailed: EventMapping = (event, data, context) => [
  intentFor(event, data.text("ownerUserId"), {
    category: "payments",
    inApp: { category: "system", title: "Payment failed", body: "Your payment did not go through. Try again or use another method.", data: { paymentId: data.text("paymentId") } },
    push: { title: "Payment failed", body: "Your payment did not go through.", data: { paymentId: data.text("paymentId") } },
    email: (recipient) => plan("paymentFailed", {
      firstName: recipient.firstName, description: data.text("description", "Your Zudomart payment"), amount: data.money("amount"), paymentMethod: data.text("paymentMethod", data.text("provider")),
      reason: data.text("reason", "The payment was not completed."), retryUrl: data.text("retryUrl", `${context.webBaseUrl}/orders`),
    }),
  }),
];

export const paymentSucceeded: EventMapping = (event, data) => {
  const purpose = data.text("purpose");
  const title = purpose === "wallet_top_up" ? "Wallet topped up" : purpose === "creator_subscription" ? "Subscription payment received" : undefined;
  if (title === undefined) return [];
  return [intentFor(event, data.text("ownerUserId"), { category: "payments", inApp: { category: "system", title, body: "Your payment was received.", data: { paymentId: data.text("paymentId") } } })];
};

export const paymentDuplicateRefunded: EventMapping = (event, data) => [
  intentFor(event, data.text("ownerUserId"), {
    category: "payments",
    inApp: { category: "system", title: "Extra payment refunded", body: "You were charged twice for one purchase, so we are sending the extra payment back to you.", data: { paymentId: data.text("paymentId") } },
    push: { title: "Extra payment refunded", body: "We are sending back a second payment for the same purchase.", data: { paymentId: data.text("paymentId") } },
  }),
];

export const coinPurchaseCompleted: EventMapping = (event, data) => [
  intentFor(event, data.text("userId"), {
    category: "payments",
    inApp: { category: "system", title: "Coins added", body: `${data.integer("coins")} coins were added to your balance.`, data: { coinPurchaseId: data.text("coinPurchaseId") } },
    ...(data.text("source") !== "web" ? {} : {
      email: (recipient: Parameters<NonNullable<Parameters<typeof intentFor>[2]["email"]>>[0]) => plan("coinPurchaseReceipt", {
        firstName: recipient.firstName, receiptNumber: data.text("receiptNumber"), paidAt: data.text("paidAt", event.occurredAt), paymentMethod: data.text("paymentMethod", "Card"),
        packName: data.text("packName", data.text("packageId")), coins: data.integer("coins"), bonusCoins: data.integer("bonusCoins", 0), price: data.money("amount"), balanceAfter: data.integer("balanceAfter"),
      }),
    }),
  }),
];

function payoutIntent(outcome: "completed" | "failed"): EventMapping {
  return (event, data) => {
    const base = (firstName: string) => ({ firstName, payoutId: data.text("withdrawalId"), amount: data.money("amount"), bankAccount: data.text("bankAccountLabel", "your bank account") });
    return [
      intentFor(event, data.text("userId"), {
        category: data.text("payeeKind", "seller") === "creator" ? "creator" : "seller",
        inApp: { category: "system", title: outcome === "completed" ? "Payout sent" : "Payout failed", body: outcome === "completed" ? "Your payout is on its way to your bank." : "Your payout could not be completed. Check your bank details.", data: { withdrawalId: data.text("withdrawalId") } },
        push: { title: outcome === "completed" ? "Payout sent" : "Payout failed", body: outcome === "completed" ? "Your payout is on its way." : "Check your bank details.", data: { withdrawalId: data.text("withdrawalId") } },
        email: (recipient) => {
          if (outcome === "failed") return plan("payoutFailed", { ...base(recipient.firstName), reason: data.text("reason", "The bank could not complete the transfer."), ...(data.optionalText("retryAt") === undefined ? {} : { retryAt: data.text("retryAt") }) });
          if (data.text("payeeKind", "seller") === "creator") return plan("creatorPayoutSent", { ...base(recipient.firstName), sentAt: data.text("sentAt", event.occurredAt) });
          return plan("payoutSent", { ...base(recipient.firstName), sentAt: data.text("sentAt", event.occurredAt), bankReference: data.text("reference") });
        },
      }),
    ];
  };
}

export const payoutCompleted = payoutIntent("completed");
export const payoutFailed = payoutIntent("failed");

export function withdrawalStatusMapping(title: string, body: string): EventMapping {
  return (event, data) => [intentFor(event, data.text("userId"), { category: "payments", inApp: { category: "system", title, body, data: { withdrawalId: data.text("withdrawalId") } } })];
}
