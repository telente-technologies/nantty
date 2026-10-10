import { buildDemoAccountRecords, buildDemoMemberRecords, buildDemoInviteRecords } from "@/mocks/seed/demoAccounts.mock";
import { buildDemoBillingRecords } from "@/mocks/seed/demoBilling.mock";
import { buildDemoCampaignRecords } from "@/mocks/seed/demoCampaigns.mock";
import { buildDemoContentSources } from "@/mocks/seed/demoContent.mock";
import { demoUsers, type MockUserRecord } from "@/mocks/seed/demoPeople.mock";
import { generateDailyStatsForAds, type MockDailyStat } from "@/mocks/seed/demoStats.mock";
import { buildDemoToolRecords } from "@/mocks/seed/demoTools.mock";
import type { AdAccountInvite, AdAccountRole, InviteStatus, LinkedBusinessProfile, AdAccountKind, AdAccountStatus } from "@/types/adAccount.type";
import type { CustomAudience } from "@/types/audience.type";
import type { BillingTransaction, FundingMode, Invoice, PaymentMethod, TopUp } from "@/types/billing.type";
import type { AdReview, AdSetInput, CampaignInput, DeliveryStatus } from "@/types/campaign.type";
import type { ContentSource, Creative, CreativeMedia } from "@/types/creative.type";
import type { ScheduledReport } from "@/types/report.type";
import type { ActivityEntry, AutomatedRule, ConversionEvent, Experiment } from "@/types/tools.type";

export interface MockAdAccountRecord {
  readonly id: string;
  name: string;
  readonly kind: AdAccountKind;
  readonly currency: string;
  timezone: string;
  readonly countryCode: string;
  status: AdAccountStatus;
  readonly business: LinkedBusinessProfile | null;
  readonly ownerUserId: string;
  readonly createdAt: string;
  balanceMinor: number;
  creditsMinor: number;
  monthlyCreditMinor: number | null;
  spendLimitMinor: number | null;
  fundingMode: FundingMode;
  paymentMethods: PaymentMethod[];
}

export interface MockMemberRecord {
  readonly accountId: string;
  readonly userId: string;
  role: AdAccountRole;
  readonly addedAt: string;
  lastActiveAt: string | null;
}

export interface MockInviteRecord extends Omit<AdAccountInvite, "status"> {
  status: InviteStatus;
  readonly accountId: string;
  readonly token: string;
}

export interface MockCampaignRecord extends CampaignInput {
  readonly id: string;
  readonly accountId: string;
  status: DeliveryStatus;
  readonly createdAt: string;
  updatedAt: string;
}

export interface MockAdSetRecord extends AdSetInput {
  readonly id: string;
  readonly accountId: string;
  readonly campaignId: string;
  status: DeliveryStatus;
  experimentId: string | null;
  readonly createdAt: string;
  updatedAt: string;
}

export interface MockAdRecord {
  readonly id: string;
  readonly accountId: string;
  readonly campaignId: string;
  readonly adSetId: string;
  name: string;
  status: DeliveryStatus;
  review: AdReview;
  creative: Creative;
  submittedAt: string | null;
  readonly createdAt: string;
  updatedAt: string;
}

export interface MockUploadRecord {
  readonly mediaId: string;
  readonly accountId: string;
  readonly userId: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly clientMetadata: { readonly width: number; readonly height: number; readonly durationSeconds: number | null } | null;
  bytes: Buffer | null;
  status: "pending_upload" | "processing";
}

export interface MockAdsDatabase {
  readonly users: MockUserRecord[];
  readonly accessTokens: Map<string, { userId: string; expiresAtEpochMs: number }>;
  readonly refreshTokens: Map<string, { userId: string; revoked: boolean }>;
  readonly accounts: MockAdAccountRecord[];
  readonly members: MockMemberRecord[];
  readonly invites: MockInviteRecord[];
  readonly campaigns: MockCampaignRecord[];
  readonly adSets: MockAdSetRecord[];
  readonly ads: MockAdRecord[];
  readonly dailyStats: MockDailyStat[];
  readonly audiences: CustomAudience[];
  readonly contentSources: (ContentSource & { readonly accountId: string })[];
  readonly uploads: Map<string, MockUploadRecord>;
  readonly media: Map<string, { readonly createdAtEpochMs: number; readonly media: CreativeMedia }>;
  readonly topUps: (TopUp & { readonly accountId: string })[];
  readonly transactions: (BillingTransaction & { readonly accountId: string })[];
  readonly invoices: (Invoice & { readonly accountId: string })[];
  readonly scheduledReports: (ScheduledReport & { readonly accountId: string })[];
  readonly conversionEvents: (ConversionEvent & { readonly accountId: string })[];
  readonly experiments: (Experiment & { readonly accountId: string })[];
  readonly rules: (AutomatedRule & { readonly accountId: string })[];
  readonly activity: (ActivityEntry & { readonly accountId: string })[];
  readonly idempotentResponses: Map<string, { readonly status: number; readonly body: unknown; readonly requestBody?: string }>;
}

function buildFreshMockDatabase(): MockAdsDatabase {
  const accounts = buildDemoAccountRecords();
  const { campaigns, adSets, ads, audiences } = buildDemoCampaignRecords();
  const billing = buildDemoBillingRecords(accounts);
  const tools = buildDemoToolRecords(campaigns, adSets);
  return {
    users: [...demoUsers],
    accessTokens: new Map(),
    refreshTokens: new Map(),
    accounts,
    members: buildDemoMemberRecords(),
    invites: buildDemoInviteRecords(),
    campaigns,
    adSets,
    ads,
    dailyStats: generateDailyStatsForAds(campaigns, adSets, ads),
    audiences,
    contentSources: buildDemoContentSources(),
    uploads: new Map(),
    media: new Map(),
    topUps: billing.topUps,
    transactions: billing.transactions,
    invoices: billing.invoices,
    scheduledReports: tools.scheduledReports,
    conversionEvents: tools.conversionEvents,
    experiments: tools.experiments,
    rules: tools.rules,
    activity: tools.activity,
    idempotentResponses: new Map(),
  };
}

const globalHolder = globalThis as typeof globalThis & { zudomartAdsMockDatabaseWithFormats?: MockAdsDatabase };

export function readMockDatabase(): MockAdsDatabase {
  globalHolder.zudomartAdsMockDatabaseWithFormats ??= buildFreshMockDatabase();
  return globalHolder.zudomartAdsMockDatabaseWithFormats;
}

export function appendMockActivity(accountId: string, entry: Omit<ActivityEntry, "id" | "createdAt">): void {
  const database = readMockDatabase();
  database.activity.unshift({ ...entry, id: `act_${Date.now().toString(36)}${database.activity.length}`, createdAt: new Date().toISOString(), accountId });
}

