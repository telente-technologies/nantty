import type { Conversation } from "@/types";

export const DISAPPEARING_MESSAGE_CHOICES = [
  { label: "Off", seconds: null },
  { label: "24 hours", seconds: 86_400 },
  { label: "7 days", seconds: 604_800 },
] as const;

export const describeDisappearingMessagesDuration = (seconds: number | null | undefined) =>
  DISAPPEARING_MESSAGE_CHOICES.find((choice) => choice.seconds === (seconds ?? null))?.label ?? `${Math.round((seconds ?? 0) / 3600)} hours`;

const formatCount = (count: number) => count.toLocaleString("en-US");

export function describeConversationForDisplay(conversation: Conversation) {
  const kind = conversation.kind ?? "direct";
  const isGroup = kind === "group";
  const isChannel = kind === "channel";
  const isBusiness = kind === "business" || !!conversation.store;
  const displayName = isGroup || isChannel ? conversation.title ?? conversation.peer.name : conversation.peer.name;
  const subtitle = isGroup
    ? `${formatCount(conversation.memberCount ?? 0)} members`
    : isChannel
      ? `${formatCount(conversation.subscriberCount ?? 0)} subscribers`
      : isBusiness && conversation.store
        ? conversation.store.name
        : null;
  return {
    displayName,
    avatarUrl: conversation.photoUrl ?? (isGroup || isChannel ? null : conversation.peer.avatarUrl),
    isGroup,
    isChannel,
    isBusiness,
    subtitle,
    canPostMessages: !isChannel || conversation.myRole === "owner" || conversation.myRole === "admin",
    isAdmin: conversation.myRole === "owner" || conversation.myRole === "admin",
  };
}
