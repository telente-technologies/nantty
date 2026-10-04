import type { LiveReportReason } from "@/services/reports.service";

export interface LiveReportReasonOption {
  readonly reason: LiveReportReason;
  readonly label: string;
  readonly isUrgent?: boolean;
}

export const LIVE_REPORT_REASON_OPTIONS: readonly LiveReportReasonOption[] = [
  { reason: "child_safety", label: "Child safety", isUrgent: true },
  { reason: "self_harm", label: "Self-harm or suicide", isUrgent: true },
  { reason: "violence", label: "Violence or dangerous acts", isUrgent: true },
  { reason: "sexual_content", label: "Nudity or sexual content" },
  { reason: "hate", label: "Hate" },
  { reason: "harassment", label: "Harassment or bullying" },
  { reason: "scam", label: "Scam or fraud" },
  { reason: "intellectual_property", label: "Copyright or intellectual property" },
  { reason: "other", label: "Something else" },
];

export const LIVE_REPORT_COOLDOWN_MS = 60_000;
export const MAXIMUM_LIVE_REPORT_DETAILS_LENGTH = 500;

export const LIVE_SELF_HARM_SUPPORT_NOTICE =
  "You're not alone. If you or someone on this live is in immediate danger, contact your local emergency number now. Free, confidential helplines are listed at findahelpline.com.";
export const LIVE_URGENT_REPORT_NOTICE = "Urgent reports go straight to our safety team, who review them first.";

const lastLiveReportAtByLiveId = new Map<string, number>();

export function readLiveReportCooldownRemainingMs(liveId: string, now: number = Date.now()): number {
  const lastReportedAt = lastLiveReportAtByLiveId.get(liveId);
  return lastReportedAt === undefined ? 0 : Math.max(0, LIVE_REPORT_COOLDOWN_MS - (now - lastReportedAt));
}

export function rememberLiveReportSent(liveId: string, now: number = Date.now()) {
  lastLiveReportAtByLiveId.set(liveId, now);
}

export function formatLiveReportMoment(offsetSeconds: number): string {
  const whole = Math.max(0, Math.floor(offsetSeconds));
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const seconds = String(whole % 60).padStart(2, "0");
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}` : `${minutes}:${seconds}`;
}
