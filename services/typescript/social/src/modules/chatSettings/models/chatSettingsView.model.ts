import type { ChatSettings } from "../../../generated/prisma/client.js";
import type { ChatSettingsView } from "./chatSettings.model.js";

export const defaultChatSettingsView: ChatSettingsView = {
  messageRequestsFrom: "everyone",
  notifications: { messages: true, requests: true, groups: true, streakReminders: true, showMessagePreview: true },
  timezone: "UTC",
};

export function toChatSettingsView(row: ChatSettings | null): ChatSettingsView {
  if (row === null) return defaultChatSettingsView;
  return {
    messageRequestsFrom: row.messageRequestsFrom,
    notifications: { messages: row.notifyMessages, requests: row.notifyRequests, groups: row.notifyGroups, streakReminders: row.notifyStreakReminders, showMessagePreview: row.showMessagePreview },
    timezone: row.timezone,
  };
}
