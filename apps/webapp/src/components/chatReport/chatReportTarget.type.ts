import type { ChatReportTargetType, Message, UserSummary } from "@/types";

export interface ChatReportTarget {
  readonly kind: ChatReportTargetType;
  readonly conversationId: string;
  readonly reportedUser: UserSummary | null;
  readonly message: Message | null;
  readonly alsoBlock: boolean;
}

export type ChatReportEvidenceMode = "last_messages" | "picked_messages";

export const doesChatReportTargetCarryEvidence = (target: ChatReportTarget) => target.kind !== "user";

export const describeChatReportTarget = (target: ChatReportTarget) => {
  if (target.kind === "message") return "message";
  if (target.kind === "conversation") return "conversation";
  if (target.kind === "group") return "group";
  return target.alsoBlock ? "and block" : target.reportedUser?.name ?? "this person";
};
