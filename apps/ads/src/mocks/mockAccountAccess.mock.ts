import { doesRoleHavePermission, type AdsPermission } from "@/config/rolePermissions.config";
import { readMockDatabase, type MockAdAccountRecord } from "@/mocks/mockDatabase.mock";
import { MockHttpError, requirePrincipal } from "@/mocks/mockResponses.mock";
import type { MockRequest } from "@/mocks/mockRouter.mock";
import type { AdAccount, AdAccountRole, AdAccountSummary } from "@/types/adAccount.type";

export function requireAccountAccess(request: MockRequest, permission: AdsPermission): { account: MockAdAccountRecord; role: AdAccountRole; userId: string; actorName: string } {
  const principal = requirePrincipal(request);
  const accountId = request.params.accountId ?? "";
  const database = readMockDatabase();
  const account = database.accounts.find((candidate) => candidate.id === accountId);
  const membership = database.members.find((candidate) => candidate.accountId === accountId && candidate.userId === principal.userId);
  if (!account || !membership) throw new MockHttpError(404, "AD_ACCOUNT_NOT_FOUND", "This ad account does not exist or you are not a member.");
  if (!doesRoleHavePermission(membership.role, permission)) throw new MockHttpError(403, "FORBIDDEN", "Your role on this ad account does not allow this.");
  membership.lastActiveAt = new Date().toISOString();
  return { account, role: membership.role, userId: principal.userId, actorName: principal.actorName };
}

export function presentAccountSummary(account: MockAdAccountRecord, role: AdAccountRole): AdAccountSummary {
  const database = readMockDatabase();
  return {
    id: account.id,
    name: account.name,
    kind: account.kind,
    currency: account.currency,
    timezone: account.timezone,
    countryCode: account.countryCode,
    status: account.status,
    myRole: role,
    verifiedBusiness: account.kind === "business" && Boolean(account.business?.goldVerified),
    business: account.business,
    balance: { amountMinor: account.balanceMinor, currency: account.currency },
    activeCampaignCount: database.campaigns.filter((campaign) => campaign.accountId === account.id && campaign.status === "active").length,
  };
}

export function presentAccountDetail(account: MockAdAccountRecord, role: AdAccountRole): AdAccount {
  const database = readMockDatabase();
  const owner = database.users.find((user) => user.id === account.ownerUserId);
  const spentMinor = database.dailyStats.reduce((total, stat) => {
    const ad = database.ads.find((candidate) => candidate.id === stat.adId);
    return ad?.accountId === account.id ? total + stat.spendMinor : total;
  }, 0);
  return {
    ...presentAccountSummary(account, role),
    createdAt: account.createdAt,
    owner: { id: account.ownerUserId, name: owner?.name ?? "Owner" },
    amountSpent: { amountMinor: spentMinor, currency: account.currency },
    disabledReason: account.status === "disabled" ? "Payment failed three times." : null,
  };
}

export function findRecordInAccount<Record extends { readonly id: string; readonly accountId: string }>(records: readonly Record[], accountId: string, id: string | undefined, label: string): Record {
  const record = records.find((candidate) => candidate.id === id && candidate.accountId === accountId);
  if (!record) throw new MockHttpError(404, "NOT_FOUND", `That ${label} was not found in this ad account.`);
  return record;
}
