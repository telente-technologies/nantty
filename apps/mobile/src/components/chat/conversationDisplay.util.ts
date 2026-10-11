import type { Conversation } from "@/types";

export const DISAPPEARING_MESSAGE_CHOICES = [
  { label: "Off", seconds: null },
  { label: "24 hours", seconds: 86_400 },
  { label: "7 days", seconds: 604_800 },
] as const;

export const describeDisappearingMessagesDuration = (seconds: number | null | undefined) =>
  DISAPPEARING_MESSAGE_CHOICES.find((choice) => choice.seconds === (seconds ?? null))?.label ?? `${Math.round((seconds ?? 0) / 3600)} hours`;

const formatCount = (count: number) => count.toLocaleString("en-US");

const formatCountWithSingularOrPluralNoun = (count: number, singularNoun: string, pluralNoun: string) =>
  `${formatCount(count)} ${count === 1 ? singularNoun : pluralNoun}`;

export const storeNameOf = (conversation: Conversation) => conversation.store?.name || conversation.peer.name || "Store";

export function asSeenFromStoreChat<T extends { readonly senderId: string; readonly sender?: Conversation["peer"] }>(message: T, conversation: Conversation, myUserId: string): T {
  if (message.senderId === myUserId) return message;
  const base = message.sender ?? conversation.peer;
  return { ...message, sender: { ...base, id: conversation.store?.id ?? base.id, name: storeNameOf(conversation), avatarUrl: conversation.store?.avatarUrl ?? conversation.peer.avatarUrl ?? null } };
}

export function describeConversationForDisplay(conversation: Conversation) {
  const kind = conversation.kind ?? "direct";
  const isGroup = kind === "group";
  const isChannel = kind === "channel";
  const isBusiness = kind === "business" || !!conversation.store;
  const displayName = isGroup ? conversation.title || "Group" : isChannel ? conversation.title ?? conversation.peer.name : isBusiness ? storeNameOf(conversation) : conversation.peer.name;
  const subtitle = isGroup
    ? formatCountWithSingularOrPluralNoun(conversation.memberCount ?? 0, "member", "members")
    : isChannel
      ? formatCountWithSingularOrPluralNoun(conversation.subscriberCount ?? 0, "subscriber", "subscribers")
      : null;
  return {
    displayName,
    avatarUrl: conversation.photoUrl ?? (isGroup || isChannel ? null : isBusiness ? (conversation.store?.avatarUrl ?? conversation.peer.avatarUrl ?? null) : conversation.peer.avatarUrl),
    isGroup,
    isChannel,
    isBusiness,
    subtitle,
    canPostMessages: !isChannel || conversation.myRole === "owner" || conversation.myRole === "admin",
    isAdmin: conversation.myRole === "owner" || conversation.myRole === "admin",
  };
}
