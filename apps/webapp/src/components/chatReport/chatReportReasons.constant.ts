import type { ChatReportReason } from "@/types";

export interface ChatReportReasonOption {
  readonly reason: ChatReportReason;
  readonly label: string;
  readonly isUrgent?: boolean;
}

export const CHAT_REPORT_REASON_OPTIONS: readonly ChatReportReasonOption[] = [
  { reason: "child_safety", label: "Child safety", isUrgent: true },
  { reason: "self_harm", label: "Self-harm or suicide" },
  { reason: "violence_or_threats", label: "Violence or threats" },
  { reason: "harassment_or_bullying", label: "Harassment or bullying" },
  { reason: "hate", label: "Hate" },
  { reason: "sexual_content", label: "Sexual content" },
  { reason: "spam_or_scam", label: "Spam or scam" },
  { reason: "fraud_or_payment_scam", label: "Fraud or payment scam" },
  { reason: "impersonation", label: "Impersonation" },
  { reason: "prohibited_items", label: "Selling prohibited items" },
  { reason: "other", label: "Other" },
];

export const DEFAULT_LAST_MESSAGES_COUNT = 20;
export const LAST_MESSAGES_COUNT_CHOICES = [10, 20, 50] as const;
export const MAXIMUM_CHAT_REPORT_DETAILS_LENGTH = 500;

export const CHAT_REPORT_EVIDENCE_CONSENT_NOTICE =
  "These messages will be sent to Nantty for review. The other person won't be told who reported them.";
export const CHAT_REPORT_ENCRYPTION_NOTICE =
  "Chats are end-to-end encrypted, so Nantty can't read them. Only the messages you choose below leave your device.";
export const SELF_HARM_SUPPORT_NOTICE =
  "You're not alone. If you or someone else is in immediate danger, contact your local emergency number now. Talking to someone you trust or a local crisis line can help. You can find free helplines at findahelpline.com.";
export const CHILD_SAFETY_PRIORITY_NOTICE = "Child safety reports are reviewed first by a specialist team.";
