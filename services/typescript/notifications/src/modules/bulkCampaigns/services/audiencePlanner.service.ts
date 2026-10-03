import { validationError } from "../../../errors/notifications.error.js";
import type { IdentityDirectory } from "../../../interfaces/identityDirectory.interface.js";
import type { AudienceKind } from "../../../types/campaign.type.js";
import type { MailKind } from "../../../types/notification.type.js";

export type AudienceRequest = { readonly type: "USER"; readonly username: string } | { readonly type: "SEGMENT"; readonly segmentId: string };

export interface AudiencePlan {
  readonly audienceKind: AudienceKind;
  readonly audienceRef: string;
  readonly audienceLabel: string;
  readonly totalCount: number;
  readonly eligibleCount: number;
  readonly skippedNoMarketingConsent: number;
}

export class AudiencePlannerService {
  public constructor(private readonly identity: IdentityDirectory) {}

  public async plan(audience: AudienceRequest, mailKind: MailKind): Promise<AudiencePlan> {
    if (audience.type === "USER") {
      const username = audience.username.replace(/^@/, "").toLowerCase();
      const recipient = await this.identity.findRecipientByUsername(username);
      if (recipient === null) throw validationError("No account uses that username.", [{ path: "audience.username", message: "No account uses that username." }]);
      const eligible = mailKind !== "marketing" || recipient.marketingConsent ? 1 : 0;
      return { audienceKind: "USER", audienceRef: recipient.accountId, audienceLabel: `@${recipient.username}`, totalCount: 1, eligibleCount: eligible, skippedNoMarketingConsent: 1 - eligible };
    }
    const segment = (await this.identity.listSegments()).find((candidate) => candidate.id === audience.segmentId);
    if (segment === undefined) throw validationError("Choose a segment.", [{ path: "audience.segmentId", message: "Choose a segment." }]);
    const eligible = mailKind === "marketing" ? segment.marketingConsentCount : segment.recipientCount;
    return { audienceKind: "SEGMENT", audienceRef: segment.id, audienceLabel: `Segment: ${segment.label}`, totalCount: segment.recipientCount, eligibleCount: eligible, skippedNoMarketingConsent: segment.recipientCount - eligible };
  }
}
