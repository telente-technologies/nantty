import { intentFor, type EventMapping } from "./mappingHelpers.js";

export const reviewCreated: EventMapping = (event, data, context) => {
  const rating = data.integer("rating", 0);
  const body = rating > 0 ? `A buyer left a ${rating}-star review on ${data.text("storeName", "your store")}.` : `A buyer reviewed ${data.text("storeName", "your store")}.`;
  const url = `${context.sellerDashboardUrl}/reviews`;
  return [
    intentFor(event, data.text("storeOwnerAccountId"), {
      category: "seller",
      inApp: { category: "orders", title: "New review", body, data: { url, reviewId: data.text("reviewId") } },
      push: { title: "New review", body, data: { url } },
    }),
  ];
};

export const reviewReplied: EventMapping = (event, data) => {
  if (!data.bool("firstReply", true)) return [];
  const productId = data.optionalText("productId");
  const url = productId === undefined ? `/stores/${data.text("storeId")}` : `/products/${productId}`;
  const body = `${data.text("storeName", "The seller")} replied to your review.`;
  return [
    intentFor(event, data.text("authorAccountId"), {
      category: "orders",
      inApp: { category: "orders", title: "The seller replied to your review", body, data: { url, reviewId: data.text("reviewId") } },
      push: { title: "The seller replied to your review", body, data: { url } },
    }),
  ];
};

export const sellerApplicationReviewed: EventMapping = (event, data, context) => {
  const approved = data.text("decision") === "approved";
  const storeName = data.text("storeName", "your store");
  const title = approved ? "Your store is approved" : "Your seller application was not approved";
  const body = approved ? `${storeName} is ready. Open the seller dashboard to add products.` : `We could not approve ${storeName}. ${data.text("reason", "")}`.trim();
  const url = approved ? context.sellerDashboardUrl : "/sell";
  return [
    intentFor(event, data.text("accountId"), {
      category: "seller",
      inApp: { category: "system", title, body, data: { url, applicationId: data.text("applicationId") } },
      push: { title, body, data: { url } },
    }),
  ];
};

export const creatorStandingChanged: EventMapping = (event, data) => {
  const suspended = data.text("status") === "suspended";
  const title = suspended ? "Your creator account is suspended" : "Your creator account is active again";
  const body = suspended ? `Creator earnings are paused. ${data.text("reason", "")}`.trim() : "You can earn from gifts, tips and subscriptions again.";
  return [
    intentFor(event, data.text("userId"), {
      category: "creator",
      inApp: { category: "system", title, body, data: { url: "/creator" } },
      push: { title, body, data: { url: "/creator" } },
    }),
  ];
};

export const messageSent: EventMapping = (event, data) => {
  const conversationId = data.text("conversationId");
  const kind = data.text("conversationKind", "direct");
  const sender = data.text("senderName", "Someone");
  const inGroup = kind === "group" || kind === "channel";
  const groupTitle = data.optionalText("conversationTitle");
  return data.objectList("pushRecipients").map((recipient) => {
    const showPreview = recipient.bool("showPreview", true);
    const title = showPreview ? (inGroup && groupTitle !== undefined ? groupTitle : sender) : "Nantty";
    const body = showPreview ? (inGroup ? `${sender} sent a message` : "Sent you a message") : "New message";
    return intentFor(event, recipient.text("userId"), {
      category: "social",
      variant: "chat",
      push: {
        title,
        body,
        data: {
          url: `/chats/${conversationId}`,
          conversationId,
          recipientAccountId: recipient.text("userId"),
          messageId: data.text("messageId"),
          ...(showPreview && data.optionalText("senderName") ? { senderName: data.text("senderName") } : {}),
          ...(showPreview && data.optionalText("conversationKind") ? { conversationKind: data.text("conversationKind") } : {}),
          tag: `nantty-chat-${recipient.text("userId").length}:${recipient.text("userId")}:${conversationId.length}:${conversationId}`,
          categoryId: "NANTTY_CHAT",
          threadIdentifier: conversationId,
          vibrate: String(recipient.bool("vibration", true)),
          bubbleAllowed: String(recipient.bool("bubbleAllowed", false)),
        },
        categoryId: "NANTTY_CHAT",
        threadId: conversationId,
        channelId: `nantty-chat-${recipient.bool("sound", true) ? "sound" : "silent"}-${recipient.bool("vibration", true) ? "vibrate" : "still"}`,
        sound: recipient.bool("sound", true) ? "default" : null,
      },
    });
  });
};
