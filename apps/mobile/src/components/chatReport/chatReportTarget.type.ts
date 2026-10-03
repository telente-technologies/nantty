import type { LocallyStoredMessage } from "@/cache/messageHistory.type";
import type { ChatReportTargetType, UserSummary } from "@/types";

export interface ChatReportTarget {
  readonly kind: ChatReportTargetType;
  readonly conversationId: string;
  readonly reportedUser: UserSummary | null;
  readonly message: LocallyStoredMessage | null;
  readonly alsoBlock: boolean;
}

export const doesChatReportTargetCarryEvidence = (target: ChatReportTarget) => target.kind !== "user";

export const describeChatReportTarget = (target: ChatReportTarget) => {
  const personName = target.reportedUser?.name ?? "this person";
  if (target.kind === "message") return "message";
  if (target.kind === "conversation") return "conversation";
  if (target.kind === "group") return "group";
  return target.alsoBlock ? `${personName} and block` : personName;
};
