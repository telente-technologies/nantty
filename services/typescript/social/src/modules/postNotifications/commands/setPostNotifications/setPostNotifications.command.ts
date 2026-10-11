import type { PostNotificationLevel } from "../../models/postNotifications.model.js";

export interface SetPostNotificationsCommand {
  readonly followerId: string;
  readonly targetId: string;
  readonly level: PostNotificationLevel;
}
