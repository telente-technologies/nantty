export interface SubmitReportCommand {
  readonly reporterId: string;
  readonly targetType: "user" | "message" | "conversation" | "group" | "post" | "comment" | "clip";
  readonly targetId: string;
  readonly conversationId: string | undefined;
  readonly reportedUserId: string | undefined;
  readonly reason: string;
  readonly details: string;
  readonly blockReportedUser: boolean;
  readonly evidence: readonly Record<string, unknown>[];
  readonly evidenceSelection: string | undefined;
  readonly evidenceHash: string | undefined;
}
