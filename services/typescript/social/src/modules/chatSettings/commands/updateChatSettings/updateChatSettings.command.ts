import type { ChatNotificationSettings, MessageRequestAudience } from "../../models/chatSettings.model.js";

export interface UpdateChatSettingsCommand {
  readonly accountId: string;
  readonly messageRequestsFrom: MessageRequestAudience | undefined;
  readonly preventDirectGroupAdds: boolean | undefined;
  readonly notifications: Partial<ChatNotificationSettings> | undefined;
  readonly timezone: string | undefined;
}
