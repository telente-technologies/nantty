import { ApiError } from "@/errors/api.error";
import type {
  CreatorAffiliationRequest,
  CreatorApplication,
  CreatorApplicationInput,
  CreatorDashboard,
  CreatorDashboardPeriod,
  CreatorEligibility,
} from "@/types/creator.type";

import {
  buildCreatorTopContent,
  creatorAffiliationRecords,
  creatorEarningRecords,
  creatorEarningsUsdCentsByStatus,
  presentAffiliation,
  presentCreatorEarning,
  signedInUserIsApprovedCreator,
} from "./creatorFixtures.mock";
import { getSignedInMockUser } from "./fixtures.mock";
import { convertUsdCentsToViewerCurrency } from "./locale.mock";
import { findCatalogSeedByProductId } from "./productCatalog.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";

const DAY_IN_MS = 86_400_000;
const PERIOD_HOURS: Record<CreatorDashboardPeriod, number> = { week: 168, month: 720, all: Number.POSITIVE_INFINITY };
const EARNINGS_PAGE_SIZE = 6;

const creatorApplicationsByUserId = new Map<string, CreatorApplication>();

function buildEligibilityForSignedInUser(): CreatorEligibility {
  const user = getSignedInMockUser();
  const accountAgeInDays = Math.floor((Date.now() - new Date(user.joinedAt).getTime()) / DAY_IN_MS);
  const requirements = [
    { key: "followers" as const, label: "At least 1,000 followers", currentValue: user.followers, requiredValue: 1000 },
    { key: "account_age" as const, label: "Account at least 30 days old", currentValue: accountAgeInDays, requiredValue: 30 },
    { key: "no_violations" as const, label: "No community guideline strikes in 90 days", currentValue: 1, requiredValue: 1 },
    { key: "posts" as const, label: "At least 10 posts", currentValue: user.posts, requiredValue: 10 },
  ].map((requirement) => ({ ...requirement, met: requirement.currentValue >= requirement.requiredValue }));
  return { eligible: requirements.every((requirement) => requirement.met), requirements };
}

const approvedApplicationForDemoCreator = (): CreatorApplication => ({
  id: "ca_demo",
  status: "approved",
  contentCategories: ["lifestyle", "food"],
  submittedAt: "2025-06-01T09:00:00.000Z",
  reviewedAt: "2025-06-03T15:00:00.000Z",
  rejectionReason: null,
  reapplyAvailableAt: null,
});

const requireApprovedCreator = () => {
  if (!signedInUserIsApprovedCreator()) throw new ApiError(403, "Join the Creator Program to see earnings", "CREATOR_PROGRAM_REQUIRED");
};

function buildCreatorDashboard(period: CreatorDashboardPeriod): CreatorDashboard {
  const inPeriod = creatorEarningRecords.filter((record) => record.hoursAgo <= PERIOD_HOURS[period]);
  const sumOf = (source: string) => inPeriod.filter((record) => record.source === source).reduce((sum, record) => sum + record.usdCents, 0);
  const { availableUsdCents, pendingUsdCents } = creatorEarningsUsdCentsByStatus();
  return {
    period,
    earnings: {
      gifts: convertUsdCentsToViewerCurrency(sumOf("gift")),
      affiliateCommissions: convertUsdCentsToViewerCurrency(sumOf("affiliate_commission")),
      bonuses: convertUsdCentsToViewerCurrency(sumOf("bonus")),
      total: convertUsdCentsToViewerCurrency(inPeriod.reduce((sum, record) => sum + record.usdCents, 0)),
    },
    pendingBalance: convertUsdCentsToViewerCurrency(pendingUsdCents),
    availableBalance: convertUsdCentsToViewerCurrency(availableUsdCents),
    followersGained: period === "week" ? 214 : period === "month" ? 862 : 6840,
    topContent: buildCreatorTopContent(),
  };
}

export const creatorProgramMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/creators/eligibility", () => buildEligibilityForSignedInUser()),
  createMockRoute("GET", "/api/v1/creators/applications/me", () =>
    signedInUserIsApprovedCreator() ? approvedApplicationForDemoCreator() : creatorApplicationsByUserId.get(getSignedInMockUser().id) ?? null,
  ),
  createMockRoute("POST", "/api/v1/creators/applications", ({ body }) => {
    const userId = getSignedInMockUser().id;
    const existing = creatorApplicationsByUserId.get(userId);
    if (existing?.status === "pending") return existing;
    const input = body as CreatorApplicationInput;
    if (input.contentCategories.length === 0) throw new ApiError(422, "Pick at least one content category");
    if (!input.acceptedCreatorTermsVersion) throw new ApiError(422, "Accept the Creator terms to continue");
    const eligibility = buildEligibilityForSignedInUser();
    const application: CreatorApplication = {
      id: `ca_${Date.now()}`,
      status: eligibility.eligible ? "pending" : "rejected",
      contentCategories: input.contentCategories,
      submittedAt: new Date().toISOString(),
      reviewedAt: eligibility.eligible ? null : new Date().toISOString(),
      rejectionReason: eligibility.eligible
        ? null
        : `Not eligible yet: ${eligibility.requirements.filter((r) => !r.met).map((r) => r.label.toLowerCase()).join(", ")}.`,
      reapplyAvailableAt: eligibility.eligible ? null : new Date(Date.now() + 30 * DAY_IN_MS).toISOString(),
    };
    creatorApplicationsByUserId.set(userId, application);
    return application;
  }),
  createMockRoute("GET", "/api/v1/creators/dashboard", ({ query }) => {
    requireApprovedCreator();
    return buildCreatorDashboard((query.get("period") as CreatorDashboardPeriod | null) ?? "month");
  }),
  createMockRoute("GET", "/api/v1/creators/affiliations", () => {
    requireApprovedCreator();
    return creatorAffiliationRecords.map(presentAffiliation);
  }),
  createMockRoute("POST", "/api/v1/creators/affiliations", ({ body }) => {
    requireApprovedCreator();
    const { productId, storeId } = body as CreatorAffiliationRequest;
    const seed = productId ? findCatalogSeedByProductId(productId) : undefined;
    const targetStoreId = seed?.storeId ?? storeId;
    if (!targetStoreId) throw new ApiError(422, "Choose a product or store");
    const duplicate = creatorAffiliationRecords.find((r) => r.storeId === targetStoreId && (r.productKey ?? null) === (seed?.key ?? null));
    if (duplicate) return presentAffiliation(duplicate);
    const record = { id: `af_${Date.now()}`, storeId: targetStoreId, productKey: seed?.key ?? null, commissionPercent: 8, status: "requested" as const, salesCount: 0, earnedUsdCents: 0 };
    creatorAffiliationRecords.unshift(record);
    return presentAffiliation(record);
  }),
  createMockRoute("GET", "/api/v1/creators/earnings", ({ query }) => {
    requireApprovedCreator();
    const start = Number(query.get("cursor") ?? 0);
    const ordered = [...creatorEarningRecords].sort((a, b) => a.hoursAgo - b.hoursAgo);
    const data = ordered.slice(start, start + EARNINGS_PAGE_SIZE).map(presentCreatorEarning);
    return { data, nextCursor: start + EARNINGS_PAGE_SIZE < ordered.length ? String(start + EARNINGS_PAGE_SIZE) : null };
  }),
];
