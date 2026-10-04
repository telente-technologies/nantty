import type { AccountHealth, CounterNoticeInput, ID } from "@/types";

import { api } from "./apiClient.service";

export const ACCOUNT_HEALTH_QUERY_KEY = ["account", "status"] as const;

export const accountHealthService = {
  fetchMyAccountHealth: () => api.get<AccountHealth>("/api/v1/account/status"),
  appealStrike: (strikeId: ID, message: string) => api.post<{ status: string }>(`/api/v1/account/status/strikes/${strikeId}/appeal`, { message }),
  submitCounterNotice: (claimId: ID, input: CounterNoticeInput) =>
    api.post<{ noticeId: ID; restoreEligibleAt: string }>(`/api/v1/copyright/claims/${claimId}/counter-notices`, input),
};

export const describeAccountStanding = (status: AccountHealth["status"]) =>
  ({ GOOD_STANDING: "Good standing", AT_RISK: "At risk", RESTRICTED: "Restricted" })[status];

export const describeRestriction = (restriction: AccountHealth["restrictions"][number]) =>
  ({ MONETISATION: "Earning money (gifts, ads revenue share, subscriptions)", GOING_LIVE: "Going live" })[restriction];

export function formatTimeRemaining(deadlineAt: string, now: number = Date.now()): string {
  const remainingMinutes = Math.max(0, Math.floor((Date.parse(deadlineAt) - now) / 60_000));
  if (remainingMinutes === 0) return "Deadline passed";
  const hours = Math.floor(remainingMinutes / 60);
  const minutes = remainingMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m left` : `${minutes}m left`;
}

export const parseTimestampToSeconds = (value: string): number | null => {
  const match = /^(?:(\d+):)?(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  return Number(match[1] ?? 0) * 3600 + Number(match[2]) * 60 + Number(match[3]);
};
