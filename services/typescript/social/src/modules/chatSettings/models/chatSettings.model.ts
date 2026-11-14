export type MessageRequestAudience = "everyone" | "following" | "followers" | "nobody";

export interface ChatNotificationSettings {
  readonly messages: boolean;
  readonly requests: boolean;
  readonly groups: boolean;
  readonly streakReminders: boolean;
  readonly showMessagePreview: boolean;
  readonly sound: boolean;
  readonly vibration: boolean;
  readonly bubbles: boolean;
  readonly bubbleMode: "all" | "selected";
  readonly bubbleConversationIds: readonly string[];
  readonly bubbleExcludedConversationIds: readonly string[];
}

export interface ChatSettingsView {
  readonly messageRequestsFrom: MessageRequestAudience;
  readonly preventDirectGroupAdds: boolean;
  readonly notifications: ChatNotificationSettings;
  readonly timezone: string;
}
