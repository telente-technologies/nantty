import { registerMockQueueCounter } from "@/mocks/mockQueueCounters.mock";

import { registerAdCreditMockHandlers } from "./adCredits.mock";
import { registerAdsReviewMockHandlers } from "./adsReview.mock";
import { registerAdvertiserAccountMockHandlers } from "./advertiserAccounts.mock";
import { registerChatReportMockHandlers } from "./chatReports.mock";
import { registerCopyrightClaimMockHandlers } from "./copyrightClaims.mock";
import { registerCopyrightRemedyMockHandlers } from "./copyrightRemedies.mock";
import { registerLiveIncidentMockHandlers } from "./liveIncidents.mock";
import { registerModerationAppealMockHandlers } from "./moderationAppeals.mock";
import { registerModerationReportMockHandlers } from "./moderationReports.mock";
import { registerSecurityCaseMockHandlers } from "./securityCases.mock";
import { registerSuspensionMockHandlers } from "./suspensions.mock";
import { readTrustStore } from "./trustStore.mock";

function findOldestTimestamp(timestamps: readonly string[]): string | null {
  return timestamps.length === 0 ? null : [...timestamps].sort()[0] ?? null;
}

function registerTrustAndSafetyQueueCounters(): void {
  registerMockQueueCounter({
    key: "reports", label: "Reports", href: "/moderation/reports",
    readCount: () => {
      const openReports = readTrustStore().reports.filter((report) => report.status === "OPEN" || report.status === "IN_REVIEW");
      const now = new Date().toISOString();
      return { count: openReports.length, oldestAt: findOldestTimestamp(openReports.map((report) => report.firstReportedAt)), breachingSla: openReports.filter((report) => report.slaDueAt < now).length };
    },
  });
  registerMockQueueCounter({
    key: "chatReports", label: "Chat reports", href: "/moderation/chat-reports",
    readCount: () => {
      const open = readTrustStore().chatReports.filter((report) => report.status === "OPEN" || report.status === "IN_REVIEW");
      const now = new Date().toISOString();
      return { count: open.length, oldestAt: findOldestTimestamp(open.map((report) => report.createdAt)), breachingSla: open.filter((report) => report.slaDueAt < now).length };
    },
  });
  registerMockQueueCounter({
    key: "appeals", label: "Appeals", href: "/moderation/appeals",
    readCount: () => {
      const pending = readTrustStore().appeals.filter((appeal) => appeal.status === "PENDING");
      const now = new Date().toISOString();
      return { count: pending.length, oldestAt: findOldestTimestamp(pending.map((appeal) => appeal.submittedAt)), breachingSla: pending.filter((appeal) => appeal.slaDueAt < now).length };
    },
  });
  registerMockQueueCounter({
    key: "copyright", label: "Copyright claims", href: "/moderation/copyright",
    readCount: () => {
      const open = readTrustStore().copyrightClaims.filter((claim) => claim.status === "PENDING" || claim.status === "NEEDS_INFO" || claim.status === "COUNTER_NOTICE");
      return { count: open.length, oldestAt: findOldestTimestamp(open.map((claim) => claim.filedAt)) };
    },
  });
  registerMockQueueCounter({
    key: "adsReview", label: "Ads to review", href: "/ads/review",
    readCount: () => {
      const pending = readTrustStore().ads.filter((ad) => ad.status === "PENDING");
      return { count: pending.length, oldestAt: findOldestTimestamp(pending.map((ad) => ad.submittedAt)) };
    },
  });
}

export function registerTrustAndSafetyMockHandlers(): void {
  registerModerationReportMockHandlers();
  registerChatReportMockHandlers();
  registerModerationAppealMockHandlers();
  registerCopyrightClaimMockHandlers();
  registerCopyrightRemedyMockHandlers();
  registerAdCreditMockHandlers();
  registerAdsReviewMockHandlers();
  registerAdvertiserAccountMockHandlers();
  registerSuspensionMockHandlers();
  registerSecurityCaseMockHandlers();
  registerLiveIncidentMockHandlers();
  registerTrustAndSafetyQueueCounters();
}
