import type { EmailTemplateKey } from "@nantty/email-templates";

import type { PreferenceCategory } from "../../../../types/notification.type.js";

export interface DeliverEmailIfStillUnreadCommand {
  readonly eventId: string;
  readonly userId: string;
  readonly preferenceCategory: PreferenceCategory;
  readonly notificationKey: string;
  readonly emailDedupeKey: string;
  readonly templateKey: EmailTemplateKey;
  readonly props: unknown;
  readonly notBefore: string;
  readonly attempt?: number;
}
