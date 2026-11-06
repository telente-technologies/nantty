import type { EventDataReader } from "../../../utils/eventDataReader.util.js";
import { intentFor, plan, readActor, type EventMapping } from "./mappingHelpers.js";

const actorNameOf = (data: EventDataReader) => readActor(data)?.name ?? "Someone";

export const mentionCreated: EventMapping = (event, data) => {
  const surface = data.text("surface", "comment");
  const where = surface === "post" || surface === "clip" || surface === "group chat" || surface === "group" ? surface === "group" ? "group chat" : surface : "comment";
  const actor = readActor(data);
  const commentId = where === "comment" ? data.optionalText("commentId") : undefined;
  return [
    intentFor(event, data.text("recipientUserId"), {
      category: "social",
      inApp: { category: "social", kind: "mention", title: actorNameOf(data), body: data.bool("mentionedEveryone") ? `mentioned everyone in a ${where}.` : `mentioned you in a ${where}.`, actor, data: { url: data.optionalText("url") ?? null, ...(commentId === undefined ? {} : { commentId }), ...(data.optionalText("postId") ? { postId: data.optionalText("postId")! } : {}), ...(data.optionalText("conversationId") ? { conversationId: data.optionalText("conversationId")! } : {}), ...(where === "group chat" ? { messageId: event.subject } : {}) } },
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

export const followCreated: EventMapping = (event, data) => data.bool("viaRequest") ? [] : [
  intentFor(event, data.text("recipientUserId"), {
    category: "social",
    inApp: { category: "social", title: actorNameOf(data), body: "started following you.", actor: readActor(data) },
    push: { title: actorNameOf(data), body: "started following you." },
  }),
];

export const followRequestCreated: EventMapping = (event, data) => [
  intentFor(event, data.text("recipientUserId"), {
    category: "social",
    inApp: { category: "social", kind: "followRequest", title: actorNameOf(data), body: "requested to follow you.", actor: readActor(data), data: { url: "/me/follow-requests" } },
    push: { title: actorNameOf(data), body: "requested to follow you.", data: { url: "/me/follow-requests" } },
  }),
];

export const followRequestAccepted: EventMapping = (event, data) => [
  intentFor(event, data.text("recipientUserId"), {
    category: "social",
    inApp: { category: "social", kind: "followRequestAccepted", title: actorNameOf(data), body: "accepted your follow request.", actor: readActor(data), data: { url: data.optionalText("url") ?? null } },
    push: { title: actorNameOf(data), body: "accepted your follow request.", data: { url: data.optionalText("url") ?? null } },
  }),
];

export const commentCreated: EventMapping = (event, data) => [
  intentFor(event, data.text("recipientUserId"), {
    category: "social",
    inApp: { category: "social", title: actorNameOf(data), body: `commented on your ${data.text("target", "post")}.`, actor: readActor(data), data: { url: data.optionalText("url") ?? null, commentId: data.optionalText("commentId") ?? null, ...(data.optionalText("postId") ? { postId: data.optionalText("postId")! } : {}) } },
    push: { title: actorNameOf(data), body: `commented: ${data.text("excerpt", "")}`.slice(0, 120) },
  }),
];

export const postReshared: EventMapping = (event, data) => {
  const recipientUserId = data.text("originalAuthorId");
  if (recipientUserId === data.text("authorId")) return [];
  const body = !data.bool("isQuote") ? "reposted your post." : data.text("surface", "post") === "comment" ? "quoted your post in a comment." : "quoted your post.";
  const url = data.optionalText("url") ?? `/post/${data.text("postId")}`;
  return [
    intentFor(event, recipientUserId, {
      category: "social",
      inApp: { category: "social", kind: data.bool("isQuote") ? "quote" : "repost", title: actorNameOf(data), body, actor: readActor(data), data: { url, postId: data.text("postId"), originalPostId: data.text("originalPostId") } },
      push: { title: actorNameOf(data), body, data: { url } },
    }),
  ];
};

export const videoReplyCreated: EventMapping = (event, data) => [
  intentFor(event, data.text("recipientUserId"), {
    category: "social",
    inApp: { category: "social", kind: "videoReply", title: actorNameOf(data), body: "replied to your comment with a video.", actor: readActor(data), data: { url: data.optionalText("url") ?? null, ...(data.optionalText("commentId") ? { commentId: data.optionalText("commentId")! } : {}), ...(data.optionalText("replyClipId") ? { clipId: data.optionalText("replyClipId")! } : {}) } },
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

export const groupInvitationCreated: EventMapping = (event, data) => [
  intentFor(event, data.text("inviteeId"), {
    category: "social",
    inApp: {
      category: "social",
      kind: "groupInvitation",
      title: "Group invitation",
      body: "You received an invitation to join a group chat.",
      data: { url: "/chats/invitations", screen: "GroupInvitations", invitationId: data.text("invitationId", event.subject), conversationId: data.text("conversationId") },
    },
    push: {
      title: "Group invitation",
      body: "You received an invitation to join a group chat.",
      data: { url: "/chats/invitations", screen: "GroupInvitations" },
    },
  }),
];

export const groupInvitationAccepted: EventMapping = (event, data) => [
  intentFor(event, data.text("inviterId"), {
    category: "social",
    inApp: {
      category: "social",
      kind: "groupInvitationAccepted",
      title: "Invitation accepted",
      body: "Your group invitation was accepted. Secure key setup is still required before membership begins.",
      data: { url: "/chats/invitations", screen: "GroupInvitations", invitationId: data.text("invitationId", event.subject), conversationId: data.text("conversationId") },
    },
    push: {
      title: "Invitation accepted",
      body: "Secure key setup is still required before group membership begins.",
      data: { url: "/chats/invitations", screen: "GroupInvitations" },
    },
  }),
];

export const groupInvitationDeclined: EventMapping = (event, data) => [
  intentFor(event, data.text("inviterId"), {
    category: "social",
    inApp: {
      category: "social",
      kind: "groupInvitationDeclined",
      title: "Invitation declined",
      body: "Your group invitation was declined.",
      data: { url: "/chats/invitations", screen: "GroupInvitations", invitationId: data.text("invitationId", event.subject), conversationId: data.text("conversationId") },
    },
    push: { title: "Invitation declined", body: "Your group invitation was declined.", data: { url: "/chats/invitations", screen: "GroupInvitations" } },
  }),
];

const channelInvitationTarget = { url: "/channels/invitations", screen: "ChannelInvitations" } as const;

export const channelInvitationCreated: EventMapping = (event, data) => [
  intentFor(event, data.text("inviteeId"), {
    category: "social",
    inApp: {
      category: "social",
      kind: "channelInvitation",
      title: "Channel invitation",
      body: "You received an invitation to join a channel.",
      data: { ...channelInvitationTarget, invitationId: data.text("invitationId", event.subject), channelId: data.text("channelId") },
    },
    push: { title: "Channel invitation", body: "You received an invitation to join a channel.", data: channelInvitationTarget },
  }),
];

export const channelInvitationAccepted: EventMapping = (event, data) => [
  intentFor(event, data.text("inviterId"), {
    category: "social",
    inApp: {
      category: "social",
      kind: "channelInvitationAccepted",
      title: "Invitation accepted",
      body: "Your channel invitation was accepted.",
      data: { ...channelInvitationTarget, invitationId: data.text("invitationId", event.subject), channelId: data.text("channelId") },
    },
    push: { title: "Invitation accepted", body: "Your channel invitation was accepted.", data: channelInvitationTarget },
  }),
];

export const channelInvitationDeclined: EventMapping = (event, data) => [
  intentFor(event, data.text("inviterId"), {
    category: "social",
    inApp: {
      category: "social",
      kind: "channelInvitationDeclined",
      title: "Invitation declined",
      body: "Your channel invitation was declined.",
      data: { ...channelInvitationTarget, invitationId: data.text("invitationId", event.subject), channelId: data.text("channelId") },
    },
    push: { title: "Invitation declined", body: "Your channel invitation was declined.", data: channelInvitationTarget },
  }),
];

export const spaceInvitationCreated: EventMapping = (event, data) => [
  intentFor(event, data.text("accountId"), {
    category: "social",
    inApp: {
      category: "social",
      title: "Space invitation",
      body: "You were invited to join a Space.",
      data: { url: "/spaces", screen: "SpaceInvitations", spaceId: event.subject, invitationId: data.text("invitationId") },
    },
    push: {
      title: "Space invitation",
      body: "You were invited to join a Space.",
      data: { url: "/spaces", screen: "SpaceInvitations", spaceId: event.subject, invitationId: data.text("invitationId") },
    },
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

const minutesUntil = (scheduledAt: string, occurredAt: string) => {
  const minutes = Math.round((Date.parse(scheduledAt) - Date.parse(occurredAt)) / 60_000);
  return Number.isFinite(minutes) ? Math.max(0, minutes) : null;
};

export const liveReminderDue: EventMapping = (event, data) => {
  const hostName = data.text("hostName", "Someone you follow");
  const title = data.text("title");
  const liveId = data.text("liveId");
  const scheduledAt = data.text("scheduledAt");
  const minutes = minutesUntil(scheduledAt, event.occurredAt);
  const when = minutes === null || minutes <= 1 ? "any minute now" : `in ${minutes} minutes`;
  const payload = { liveId, scheduledAt, url: `/live/${liveId}` };
  return data.textList("notifyUserIds").map((userId) =>
    intentFor(event, userId, {
      category: "live",
      inApp: { category: "social", title: hostName, body: `goes live ${when}: ${title}`, actor: readActor(data, "host"), data: payload },
      push: { title: `${hostName} goes live ${when}`, body: title, data: payload },
    }),
  );
};
