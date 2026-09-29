import { defineEvent } from "@zudojs/events";

export interface VerificationLifecyclePayload {
  readonly profileId: string;
  readonly profileType: string;
  readonly status: string;
  readonly tier: string | null;
  readonly reason: string | null;
}

export const VerificationApplicationSubmittedEvent = defineEvent<"verifications.applicationSubmitted", VerificationLifecyclePayload>("verifications.applicationSubmitted");
export const VerificationApprovedEvent = defineEvent<"verifications.approved", VerificationLifecyclePayload>("verifications.approved");
export const VerificationRejectedEvent = defineEvent<"verifications.rejected", VerificationLifecyclePayload>("verifications.rejected");
export const VerificationSuspendedEvent = defineEvent<"verifications.suspended", VerificationLifecyclePayload>("verifications.suspended");
export const VerificationRevokedEvent = defineEvent<"verifications.revoked", VerificationLifecyclePayload>("verifications.revoked");
export const VerificationTierChangedEvent = defineEvent<"verifications.tierChanged", VerificationLifecyclePayload>("verifications.tierChanged");
