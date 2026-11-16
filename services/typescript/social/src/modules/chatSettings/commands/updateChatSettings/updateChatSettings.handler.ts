import { timezoneChangeCooldownMilliseconds } from "../../../../constants/streak.constant.js";
import { tooManyRequests, unprocessable } from "../../../../errors/social.error.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { isValidTimeZone } from "../../../../utils/localDay.util.js";
import type { ChatSettingsView } from "../../models/chatSettings.model.js";
import { toChatSettingsView } from "../../models/chatSettingsView.model.js";
import { chatSettingsRepository } from "../../repositories/chatSettings.repository.js";
import type { UpdateChatSettingsCommand } from "./updateChatSettings.command.js";

export function createUpdateChatSettingsHandler(context: HandlerContext): Handler<UpdateChatSettingsCommand, ChatSettingsView> {
  return async ({ accountId, messageRequestsFrom, preventDirectGroupAdds, notifications, timezone }) => {
    const db = context.database.client;
    const now = context.clock.now();
    const current = await chatSettingsRepository.find(db, accountId);
    if (timezone !== undefined && timezone !== (current?.timezone ?? "UTC")) {
      if (!isValidTimeZone(timezone)) throw unprocessable("INVALID_TIMEZONE", "Unknown time zone.");
      if (current?.timezoneChangedAt != null && now.getTime() - current.timezoneChangedAt.getTime() < timezoneChangeCooldownMilliseconds) {
        throw tooManyRequests("TIMEZONE_CHANGE_RATE_LIMITED", "You can change your time zone once a day.");
      }
    }
    const row = await chatSettingsRepository.upsert(db, accountId, {
      ...(messageRequestsFrom === undefined ? {} : { messageRequestsFrom }),
      ...(preventDirectGroupAdds === undefined ? {} : { preventDirectGroupAdds }),
      ...(notifications?.messages === undefined ? {} : { notifyMessages: notifications.messages }),
      ...(notifications?.requests === undefined ? {} : { notifyRequests: notifications.requests }),
      ...(notifications?.groups === undefined ? {} : { notifyGroups: notifications.groups }),
      ...(notifications?.streakReminders === undefined ? {} : { notifyStreakReminders: notifications.streakReminders }),
      ...(notifications?.showMessagePreview === undefined ? {} : { showMessagePreview: notifications.showMessagePreview }),
      ...(notifications?.sound === undefined ? {} : { notifyMessageSound: notifications.sound }),
      ...(notifications?.vibration === undefined ? {} : { notifyMessageVibration: notifications.vibration }),
      ...(notifications?.bubbles === undefined ? {} : { notifyMessageBubbles: notifications.bubbles }),
      ...(notifications?.bubbleMode === undefined ? {} : { messageBubbleMode: notifications.bubbleMode }),
      ...(notifications?.bubbleConversationIds === undefined ? {} : { messageBubbleConversationIds: [...new Set(notifications.bubbleConversationIds)] }),
      ...(notifications?.bubbleExcludedConversationIds === undefined ? {} : { messageBubbleExcludedConversationIds: [...new Set(notifications.bubbleExcludedConversationIds)] }),
      ...(timezone === undefined || timezone === (current?.timezone ?? "UTC") ? {} : { timezone, timezoneChangedAt: now }),
    });
    return toChatSettingsView(row);
  };
}
