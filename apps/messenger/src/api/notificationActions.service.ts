import * as Notifications from "expo-notifications";

export const messengerChatNotificationCategory = "NANTTY_CHAT";
export const notificationActionReply = "NANTTY_REPLY";
export const notificationActionRead = "NANTTY_MARK_READ";

export async function configureMessengerNotificationActions(enabled: boolean): Promise<void> {
  if (!enabled) {
    await Notifications.deleteNotificationCategoryAsync(messengerChatNotificationCategory).catch(() => undefined);
    return;
  }
  await Notifications.setNotificationCategoryAsync(messengerChatNotificationCategory, [
    {
      identifier: notificationActionReply,
      buttonTitle: "Reply",
      textInput: { submitButtonTitle: "Send", placeholder: "Write an encrypted reply" },
      options: { opensAppToForeground: true },
    },
    {
      identifier: notificationActionRead,
      buttonTitle: "Mark as read",
      options: { opensAppToForeground: true },
    },
  ]);
}
