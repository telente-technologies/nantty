import type { EmailTemplateKey } from "@nantty/email-templates";

import type { PreferenceCategory } from "../../../../types/notification.type.js";

export interface DeliverTemplateEmailCommand {
  readonly dedupeKey: string;
  readonly eventId: string;
  readonly userId: string;
  readonly preferenceCategory: PreferenceCategory;
  readonly templateKey: EmailTemplateKey;
  readonly props: unknown;
  readonly attempt?: number;
}
