import type { SuppressionReason } from "../../../interfaces/repositories.interface.js";
import type { MailKind, Recipient } from "../../../types/notification.type.js";

export interface EmailEligibilityInput {
  readonly mailKind: MailKind;
  readonly recipient: Pick<Recipient, "email" | "emailVerified" | "marketingConsent">;
  readonly addressVerifiedByFlow: boolean;
  readonly suppression: SuppressionReason | null;
  readonly preferenceEmailEnabled: boolean;
  readonly marketingEmailsSentInWindow: number;
  readonly marketingMaxPerWindow: number;
}

export type EmailEligibility = { readonly allowed: true } | { readonly allowed: false; readonly reason: string };

export function decideEmailEligibility(input: EmailEligibilityInput): EmailEligibility {
  const { mailKind, recipient, suppression } = input;
  if (recipient.email === null || recipient.email === "") return { allowed: false, reason: "no_email_on_account" };
  if (!recipient.emailVerified && !input.addressVerifiedByFlow) return { allowed: false, reason: "email_not_verified" };
  if (suppression === "hard_bounce") return { allowed: false, reason: "suppressed_hard_bounce" };
  if (suppression === "manual") return { allowed: false, reason: "suppressed_manual" };
  if (mailKind === "security" || mailKind === "legal") return { allowed: true };
  if (mailKind === "marketing") {
    if (suppression === "complaint") return { allowed: false, reason: "suppressed_complaint" };
    if (!recipient.marketingConsent) return { allowed: false, reason: "no_marketing_consent" };
    if (!input.preferenceEmailEnabled) return { allowed: false, reason: "preference_disabled" };
    if (input.marketingEmailsSentInWindow >= input.marketingMaxPerWindow) return { allowed: false, reason: "frequency_cap" };
    return { allowed: true };
  }
  if (!input.preferenceEmailEnabled) return { allowed: false, reason: "preference_disabled" };
  return { allowed: true };
}
