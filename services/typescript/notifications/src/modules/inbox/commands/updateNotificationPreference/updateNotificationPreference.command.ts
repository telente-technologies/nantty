import type { PreferenceCategory } from "../../../../types/notification.type.js";

export interface UpdateNotificationPreferenceCommand {
  readonly userId: string;
  readonly category: PreferenceCategory;
  readonly push?: boolean;
  readonly email?: boolean;
}
