import type { SuppressionReason } from "../../../interfaces/repositories.interface.js";
import type { MailKind, Recipient } from "../../../types/notification.type.js";

export interface EmailEligibilityInput {
  readonly mailKind: MailKind;
  readonly recipient: Pick<Recipient, "email" | "emailVerified" | "marketingConsent" | "marketingFrequency">;
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
    if (recipient.marketingFrequency === "off" || recipient.marketingFrequency === "important_only") return { allowed: false, reason: `marketing_frequency_${recipient.marketingFrequency}` };
    if (!input.preferenceEmailEnabled) return { allowed: false, reason: "preference_disabled" };
    const cap = recipient.marketingFrequency === "weekly" ? Math.min(1, input.marketingMaxPerWindow) : input.marketingMaxPerWindow;
    if (input.marketingEmailsSentInWindow >= cap) return { allowed: false, reason: "frequency_cap" };
    return { allowed: true };
  }
  if (!input.preferenceEmailEnabled) return { allowed: false, reason: "preference_disabled" };
  return { allowed: true };
}
