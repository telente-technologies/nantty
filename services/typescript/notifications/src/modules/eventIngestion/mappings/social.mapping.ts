import type { EventDataReader } from "../../../utils/eventDataReader.util.js";
import { intentFor, plan, readActor, type EventMapping } from "./mappingHelpers.js";

const actorNameOf = (data: EventDataReader) => readActor(data)?.name ?? "Someone";

export const mentionCreated: EventMapping = (event, data) => {
  const surface = data.text("surface", "comment");
  const where = surface === "post" || surface === "clip" || surface === "group chat" ? surface : "comment";
  const actor = readActor(data);
  return [
    intentFor(event, data.text("recipientUserId"), {
      category: "social",
      inApp: { category: "social", kind: "mention", title: actorNameOf(data), body: data.bool("mentionedEveryone") ? `mentioned everyone in a ${where}.` : `mentioned you in a ${where}.`, actor, data: { url: data.optionalText("url") ?? null } },
      push: { title: actorNameOf(data), body: `mentioned you in a ${where}.`, data: { url: data.optionalText("url") ?? null } },
      email: (recipient) => plan("mentionedYou", { firstName: recipient.firstName, actorName: actorNameOf(data), actorHandle: actor?.username ?? "", where, excerpt: data.text("excerpt"), url: data.text("url") }, 60),
    }),
  ];
};

export const postTagged: EventMapping = (event, data) => {
  const noun = data.text("kind", "post") === "clip" ? "clip" : "post";
  return [
    intentFor(event, data.text("recipientUserId"), {
      category: "social",
      inApp: { category: "social", title: actorNameOf(data), body: `tagged you in a ${noun}.`, actor: readActor(data), data: { url: data.optionalText("url") ?? null } },
      push: { title: actorNameOf(data), body: `tagged you in a ${noun}.`, data: { url: data.optionalText("url") ?? null } },
    }),
  ];
};

export const followCreated: EventMapping = (event, data) => [
  intentFor(event, data.text("recipientUserId"), {
    category: "social",
    inApp: { category: "social", title: actorNameOf(data), body: "started following you.", actor: readActor(data) },
    push: { title: actorNameOf(data), body: "started following you." },
  }),
];

export const followRequestCreated: EventMapping = (event, data) => [
  intentFor(event, data.text("recipientUserId"), {
    category: "social",
    inApp: { category: "social", title: actorNameOf(data), body: "requested to follow you.", actor: readActor(data) },
    push: { title: actorNameOf(data), body: "requested to follow you." },
  }),
];

export const commentCreated: EventMapping = (event, data) => [
  intentFor(event, data.text("recipientUserId"), {
    category: "social",
    inApp: { category: "social", title: actorNameOf(data), body: `commented on your ${data.text("target", "post")}.`, actor: readActor(data), data: { url: data.optionalText("url") ?? null } },
    push: { title: actorNameOf(data), body: `commented: ${data.text("excerpt", "")}`.slice(0, 120) },
  }),
];

export const videoReplyCreated: EventMapping = (event, data) => [
  intentFor(event, data.text("recipientUserId"), {
    category: "social",
    inApp: { category: "social", kind: "videoReply", title: actorNameOf(data), body: "replied to your comment with a video.", actor: readActor(data), data: { url: data.optionalText("url") ?? null } },
    push: { title: actorNameOf(data), body: "replied to your comment with a video." },
  }),
];

export const messageRequestReceived: EventMapping = (event, data) => [
  intentFor(event, data.text("recipientUserId"), {
    category: "social",
    inApp: { category: "social", title: actorNameOf(data), body: "sent you a message request.", actor: readActor(data) },
    push: { title: actorNameOf(data), body: "sent you a message request." },
  }),
];

export const giftSent: EventMapping = (event, data) => {
  const sender = readActor(data, "sender");
  const giftCount = data.integer("quantity", 1);
  return [
    intentFor(event, data.text("receiverUserId"), {
      category: "live",
      inApp: { category: "social", title: sender?.name ?? "Someone", body: `sent you ${giftCount === 1 ? "a gift" : `${giftCount} gifts`} on live.`, actor: sender, data: { liveId: data.text("liveId"), totalCoins: data.integer("totalCoins", 0) } },
      push: { title: sender?.name ?? "Someone", body: `sent you ${giftCount === 1 ? "a gift" : `${giftCount} gifts`}.` },
    }),
  ];
};

export const liveStarted: EventMapping = (event, data, context) => {
  const emailUserIds = new Set(data.textList("emailUserIds"));
  const hostName = data.text("hostName", "Someone you follow");
  return data.textList("notifyUserIds").map((userId) =>
    intentFor(event, userId, {
      category: "live",
      inApp: { category: "social", title: hostName, body: `is live: ${data.text("title")}`, actor: readActor(data, "host"), data: { liveId: data.text("liveId") } },
      push: { title: `${hostName} is live`, body: data.text("title"), data: { liveId: data.text("liveId") } },
      ...(emailUserIds.has(userId) ? {
        email: (recipient: { readonly firstName: string }) => plan("liveStarted", {
          firstName: recipient.firstName, hostName, hostHandle: data.text("hostHandle", ""), title: data.text("title"), viewerCount: data.integer("viewerCount", 0),
          liveUrl: data.text("liveUrl", `${context.webBaseUrl}/live/${data.text("liveId")}`), isShopping: data.bool("isShopping"),
        }),
      } : {}),
    }),
  );
};
