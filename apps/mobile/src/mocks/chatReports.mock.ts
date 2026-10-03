import { ApiError } from "@/errors/api.error";
import type { ChatReportInput, SubmittedChatReport } from "@/types";
import type { ContentReport } from "@/types/support.type";

import { deleteConversationState } from "./chatInboxState.mock";
import { findMockConversation } from "./chats.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";
import { blockedUserIds } from "./socialGraph.mock";

const REPORTS_PER_HOUR_LIMIT = 5;
const MAXIMUM_EVIDENCE_MESSAGES = 100;
const CHAT_REASONS = [
  "spam_or_scam", "harassment_or_bullying", "hate", "sexual_content", "child_safety", "violence_or_threats",
  "impersonation", "prohibited_items", "fraud_or_payment_scam", "self_harm", "other",
];
const REASON_LABELS: Record<string, string> = {
  spam_or_scam: "Spam or scam", harassment_or_bullying: "Harassment or bullying", hate: "Hate", sexual_content: "Sexual content",
  child_safety: "Child safety", violence_or_threats: "Violence or threats", impersonation: "Impersonation",
  prohibited_items: "Selling prohibited items", fraud_or_payment_scam: "Fraud or payment scam", self_harm: "Self-harm", other: "Other",
};

interface StoredChatReport extends ContentReport {
  readonly submittedAtMs: number;
}

const storedChatReports: StoredChatReport[] = [];

export const isChatReportBody = (body: unknown): body is ChatReportInput =>
  typeof body === "object" && body !== null && "conversationId" in body && CHAT_REASONS.includes((body as ChatReportInput).reason);

const describeTargetLabel = (input: ChatReportInput) => {
  const conversation = findMockConversation(input.conversationId);
  const name = conversation.title ?? conversation.peer.name;
  if (input.targetType === "message") return `Message from ${input.evidence[0]?.senderName ?? name}`;
  if (input.targetType === "conversation") return `Conversation with ${name}`;
  if (input.targetType === "group") return `Group: ${name}`;
  return input.reportedUserId === conversation.peer.id ? name : `Member of ${name}`;
};

export const submitChatReportMock = (input: ChatReportInput): SubmittedChatReport => {
  const recentCutoff = Date.now() - 3_600_000;
  if (storedChatReports.filter((report) => report.submittedAtMs > recentCutoff).length >= REPORTS_PER_HOUR_LIMIT) {
    throw new ApiError(429, "You've sent several reports recently. Please try again in a while.", "REPORT_RATE_LIMITED");
  }
  const needsEvidence = input.targetType !== "user";
  if (needsEvidence && (input.evidence.length === 0 || !input.evidenceHash)) throw new ApiError(422, "Choose the messages to send with your report", "EVIDENCE_REQUIRED");
  if (input.evidence.length > MAXIMUM_EVIDENCE_MESSAGES) throw new ApiError(422, "Too many messages selected", "EVIDENCE_TOO_LARGE");
  if (input.reason === "other" && !input.details.trim()) throw new ApiError(422, "Tell us what happened", "DETAILS_REQUIRED");
  const now = new Date().toISOString();
  storedChatReports.unshift({
    id: `rep_chat_${Date.now().toString(36)}`,
    targetType: input.targetType,
    targetLabel: describeTargetLabel(input),
    reason: REASON_LABELS[input.reason]!,
    status: "received",
    outcomeNote: null,
    createdAt: now,
    updatedAt: now,
    submittedAtMs: Date.now(),
  });
  if (input.blockReportedUser && input.reportedUserId) {
    blockedUserIds.add(input.reportedUserId);
    deleteConversationState(input.conversationId);
  }
  return { id: storedChatReports[0]!.id, status: "received", priority: input.reason === "child_safety" ? "urgent" : "normal" };
};

export const listMyChatReportsMock = (): ContentReport[] => storedChatReports.map(({ submittedAtMs: _submittedAtMs, ...report }) => report);

export const chatReportsMocks: MockRoute[] = [
  createMockRoute("POST", "/api/v1/conversations/:conversationId/restrict", ({ params }) => {
    findMockConversation(params.conversationId!);
  }),
];
