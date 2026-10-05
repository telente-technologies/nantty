import type { ReportTargetType } from "../../services/reportReasons.service.js";

export interface SubmitReportCommand {
  readonly reporterId: string;
  readonly targetType: ReportTargetType;
  readonly targetId: string;
  readonly conversationId: string | undefined;
  readonly reportedUserId: string | undefined;
  readonly reason: string;
  readonly details: string;
  readonly blockReportedUser: boolean;
  readonly evidence: readonly Record<string, unknown>[];
  readonly evidenceSelection: string | undefined;
  readonly evidenceHash: string | undefined;
  readonly liveContext?: LiveReportContext | undefined;
}

export interface LiveReportContext {
  readonly offsetSeconds?: number | undefined;
  readonly frameRef?: string | undefined;
  readonly capturedAt?: string | undefined;
}
