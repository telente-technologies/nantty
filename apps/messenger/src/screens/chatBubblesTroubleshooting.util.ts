import type { AndroidConversationChannelStatus } from "../api/chatBubblesNative.service";

export function androidBubblePreferenceLabel(preference: number | undefined): string {
  switch (preference) {
    case 0: return "Bubbles disabled for Messenger";
    case 1: return "Android allows all eligible Messenger bubbles";
    case 2: return "Only conversations selected in Android can bubble";
    default: return "Android bubble preference unavailable";
  }
}

export function androidConversationChannelDescription(conversation: string | null, status: AndroidConversationChannelStatus): string {
  const prefix = conversation ? `${conversation}: ` : "";
  if (status.status === "channel_not_created") return `${prefix}Android has not created a conversation channel yet. It is normally created after an eligible message notification is posted.`;
  if (status.status === "no_conversations") return "No authorized conversations are available to inspect.";
  if (status.status === "unsupported") return "Conversation channel inspection is unsupported on this Android version.";
  if (status.status !== "available") return `${prefix}Channel status is currently unavailable.`;
  const bubble = status.canBubble === null ? "bubble capability is not exposed on this Android version" : status.canBubble ? "channel permits bubbles" : "channel does not permit bubbles";
  const importance = notificationImportanceLabel(status.importance);
  return `${prefix}Channel exists; ${bubble}; ${importance}. Android user settings remain authoritative.`;
}

function notificationImportanceLabel(importance: number | null): string {
  switch (importance) {
    case 0: return "notifications blocked for this conversation";
    case 1: return "notification importance set to minimum";
    case 2: return "notification importance set to low";
    case 3: return "notification importance set to default";
    case 4: return "notification importance set to high";
    case 5: return "notification importance set to maximum";
    default: return "notification importance unavailable";
  }
}
