import type { Page } from "@/types";
import type { ContactPrivacy, NotificationCategory, NotificationPreference, WhoCanMention, WhoCanMessage } from "@/types/studioSocial.type";

import { sendRequestToStudioServer } from "./clientApi.service";

export const settingsService = {
  listNotificationPreferences: async () => (await sendRequestToStudioServer<Page<NotificationPreference>>("/api/v1/notifications/preferences")).data,
  updateNotificationPreference: (category: NotificationCategory, change: { readonly push?: boolean; readonly email?: boolean }) =>
    sendRequestToStudioServer<NotificationPreference>("/api/v1/notifications/preferences", { method: "PATCH", body: { category, ...change } }),
  fetchContactPrivacy: async (): Promise<ContactPrivacy> => {
    const [mention, message] = await Promise.all([
      sendRequestToStudioServer<Pick<ContactPrivacy, "whoCanMentionMe">>("/api/v1/users/me/mention-privacy"),
      sendRequestToStudioServer<Pick<ContactPrivacy, "whoCanMessageMe">>("/api/v1/users/me/message-privacy"),
    ]);
    return { ...mention, ...message };
  },
  updateMentionPrivacy: (whoCanMentionMe: WhoCanMention) => sendRequestToStudioServer<Pick<ContactPrivacy, "whoCanMentionMe">>("/api/v1/users/me/mention-privacy", { method: "PUT", body: { whoCanMentionMe } }),
  updateMessagePrivacy: (whoCanMessageMe: WhoCanMessage) => sendRequestToStudioServer<Pick<ContactPrivacy, "whoCanMessageMe">>("/api/v1/users/me/message-privacy", { method: "PUT", body: { whoCanMessageMe } }),
};
