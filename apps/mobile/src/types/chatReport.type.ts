import type { ID, ISODate } from "./models.type";

export type ChatReportTargetType = "user" | "message" | "conversation" | "group";

export type ChatReportReason =
  | "spam_or_scam"
  | "harassment_or_bullying"
  | "hate"
  | "sexual_content"
  | "child_safety"
  | "violence_or_threats"
  | "impersonation"
  | "prohibited_items"
  | "fraud_or_payment_scam"
  | "self_harm"
  | "other";

export type ChatReportEvidenceSelection = "last_messages" | "picked_messages";

export interface ChatReportEvidenceAttachment {
  readonly type: "voice" | "image" | "video" | "document" | "location" | "poll" | "shared";
  readonly mimeType: string | null;
  readonly fileName: string | null;
  readonly sizeBytes: number | null;
  readonly durationSeconds: number | null;
}

export interface ChatReportEvidenceMessage {
  readonly messageId: ID;
  readonly senderId: ID;
  readonly senderName: string;
  readonly sentAt: ISODate;
  readonly text: string;
  readonly attachments: readonly ChatReportEvidenceAttachment[];
}

export interface ChatReportInput {
  readonly targetType: ChatReportTargetType;
  readonly targetId: ID;
  readonly conversationId: ID;
  readonly reportedUserId: ID | null;
  readonly reason: ChatReportReason;
  readonly details: string;
  readonly blockReportedUser: boolean;
  readonly evidence: readonly ChatReportEvidenceMessage[];
  readonly evidenceSelection: ChatReportEvidenceSelection | null;
  readonly evidenceHash: string | null;
}

export interface SubmittedChatReport {
  readonly id: ID;
  readonly status: "received";
  readonly priority: "normal" | "urgent";
}
