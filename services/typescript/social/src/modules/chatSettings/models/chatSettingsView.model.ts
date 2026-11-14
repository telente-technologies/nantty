import type { ChatSettings } from "../../../generated/prisma/client.js";
import type { ChatSettingsView } from "./chatSettings.model.js";

export const defaultChatSettingsView: ChatSettingsView = {
  messageRequestsFrom: "everyone",
  preventDirectGroupAdds: false,
  notifications: { messages: true, requests: true, groups: true, streakReminders: true, showMessagePreview: true, sound: true, vibration: true, bubbles: false, bubbleMode: "selected", bubbleConversationIds: [], bubbleExcludedConversationIds: [] },
  timezone: "UTC",
};

export function toChatSettingsView(row: ChatSettings | null): ChatSettingsView {
  if (row === null) return defaultChatSettingsView;
  return {
    messageRequestsFrom: row.messageRequestsFrom,
    preventDirectGroupAdds: row.preventDirectGroupAdds,
    notifications: { messages: row.notifyMessages, requests: row.notifyRequests, groups: row.notifyGroups, streakReminders: row.notifyStreakReminders, showMessagePreview: row.showMessagePreview, sound: row.notifyMessageSound, vibration: row.notifyMessageVibration, bubbles: row.notifyMessageBubbles, bubbleMode: row.messageBubbleMode === "all" ? "all" : "selected", bubbleConversationIds: row.messageBubbleConversationIds, bubbleExcludedConversationIds: row.messageBubbleExcludedConversationIds },
    timezone: row.timezone,
  };
}
