import type { AccountHealth, CopyrightClaimInput, CopyrightClaimReceipt, CounterNoticeInput, ID } from "@/types";

import { createIdempotencyKey, sendRequestToWebappServer } from "./clientApi.service";

export const ACCOUNT_HEALTH_QUERY_KEY = ["account", "status"] as const;
export const COPYRIGHT_HELP_PATH = "/help/safety-and-reporting/copyright-and-account-status";

export const copyrightAccountService = {
  submitCopyrightClaim: (input: CopyrightClaimInput) =>
    sendRequestToWebappServer<CopyrightClaimReceipt>("/api/v1/copyright/claims", { method: "POST", body: input, idempotencyKey: createIdempotencyKey("copyright-claim") }),
  fetchMyAccountHealth: () => sendRequestToWebappServer<AccountHealth>("/api/v1/account/status"),
  appealStrike: (strikeId: ID, message: string) => sendRequestToWebappServer<{ status: string }>(`/api/v1/account/status/strikes/${strikeId}/appeal`, { method: "POST", body: { message } }),
  submitCounterNotice: (claimId: ID, input: CounterNoticeInput) =>
    sendRequestToWebappServer<{ noticeId: ID; restoreEligibleAt: string }>(`/api/v1/copyright/claims/${claimId}/counter-notices`, { method: "POST", body: input }),
};

export const describeAccountStanding = (status: AccountHealth["status"]) => ({ GOOD_STANDING: "Good standing", AT_RISK: "At risk", RESTRICTED: "Restricted" })[status];

export const describeRestriction = (restriction: AccountHealth["restrictions"][number]) =>
  ({ MONETISATION: "Earning money (gifts, ads revenue share, subscriptions)", GOING_LIVE: "Going live" })[restriction];

export function formatTimeRemaining(deadlineAt: string, now: number = Date.now()): string {
  const remainingMinutes = Math.max(0, Math.floor((Date.parse(deadlineAt) - now) / 60_000));
  if (remainingMinutes === 0) return "Deadline passed";
  const hours = Math.floor(remainingMinutes / 60);
  const minutes = remainingMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m left` : `${minutes}m left`;
}

export function parseTimestampToSeconds(value: string): number | null {
  const match = /^(?:(\d+):)?(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  return Number(match[1] ?? 0) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

export const isValidEvidenceLink = (link: string) => /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(link.trim()) && link.trim().length <= 2048;
export const splitEvidenceLinks = (text: string) => text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line !== "").slice(0, 10);
export const isValidContactEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());

export interface SegmentDraft {
  readonly start: string;
  readonly end: string;
}

export function readSegments(drafts: readonly SegmentDraft[]) {
  const filled = drafts.filter((draft) => draft.start.trim() !== "" || draft.end.trim() !== "").map((draft) => ({ startSeconds: parseTimestampToSeconds(draft.start), endSeconds: parseTimestampToSeconds(draft.end) }));
  const isValid = filled.every((segment) => segment.startSeconds !== null && segment.endSeconds !== null && segment.endSeconds > segment.startSeconds);
  return { isValid, segments: isValid ? filled.map((segment) => ({ startSeconds: segment.startSeconds ?? 0, endSeconds: segment.endSeconds ?? 0 })) : [] };
}
