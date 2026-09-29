import { findCurrencyForCountry, normalizeCountryCode } from "../../../configs/currency.config.js";
import { StoreRole } from "../../../constants/roles.constant.js";
import type { CurrencyCode } from "../../../enums/currency.enum.js";
import { adsConflict, adsError, adsNotFound, throwIfValidationIssues, type ValidationIssue } from "../../../errors/ads.error.js";
import type { AdvertiserAccount } from "../../../interfaces/advertiserBilling.interface.js";
import type { StoreSummary } from "../../../interfaces/storeAccess.interface.js";
import { Money } from "../../../utils/money.util.js";
import type { AdAccountRecord, AdAccountRole, AdAccountMemberRecord } from "../models/adAccounts.model.js";
import type { AdsDependencies } from "../models/adsDependencies.model.js";
import { describeFieldChanges, type AdAccountAccess } from "./adAccountAccess.service.js";

const MAXIMUM_ADMIN_ACCOUNTS = 10;
const CURRENCY_HOME_COUNTRY: Readonly<Record<string, string>> = { NGN: "NG", GHS: "GH", KES: "KE", ZAR: "ZA", GBP: "GB", EUR: "DE", USD: "US" };

export interface CreateAdAccountInput {
  readonly name: string;
  readonly kind: "personal" | "business";
  readonly storeId: string | null;
  readonly countryCode: string;
  readonly timezone: string;
}

export function describeAdvertiser(account: AdAccountRecord): AdvertiserAccount {
  return account.storeId === null ? { type: "user", id: account.ownerId } : { type: "store", id: account.storeId };
}

export class AdAccountsService {
  public constructor(private readonly dependencies: AdsDependencies, private readonly access: AdAccountAccess) {}

  public async listMemberships(userId: string) {
    const memberships = await this.dependencies.accounts.listMembershipsForUser(userId);
    return { items: memberships.map((membership) => ({ accountId: membership.accountId, role: membership.role })) };
  }

  public async listAccounts(userId: string) {
    const memberships = await this.dependencies.accounts.listMembershipsForUser(userId);
    const accounts = await this.dependencies.accounts.findAccountsByIds(memberships.map((membership) => membership.accountId));
    const roles = new Map(memberships.map((membership) => [membership.accountId, membership.role]));
    const items = await Promise.all(accounts.map((account) => this.presentSummary(account, roles.get(account.id) ?? "analyst")));
    return { items: items.sort((left, right) => left.name.localeCompare(right.name)) };
  }

  public async listBusinessProfiles(userId: string) {
    const storeIds = await this.dependencies.storeAccess.listStoreIdsForMember(userId);
    const managed: string[] = [];
    for (const storeId of storeIds) {
      try {
        await this.dependencies.storeAccess.assertStoreMember(userId, storeId, [StoreRole.OWNER, StoreRole.MANAGER]);
        managed.push(storeId);
      } catch {
        continue;
      }
    }
    const stores = managed.length === 0 ? [] : await this.dependencies.storeAccess.findStoreSummaries(managed);
    return { items: await Promise.all(stores.map((store) => this.presentBusinessProfile(store))) };
  }

  public async createAccount(userId: string, input: CreateAdAccountInput) {
    const { accounts, storeAccess, clock } = this.dependencies;
    const issues: ValidationIssue[] = [];
    const name = input.name.trim();
    if (name.length === 0 || name.length > 120) issues.push({ path: "name", message: "Name the ad account (up to 120 characters)." });
    const countryCode = normalizeCountryCode(input.countryCode);
    if (countryCode === null) issues.push({ path: "countryCode", message: "Choose a country." });
    if (input.kind === "business" && input.storeId === null) issues.push({ path: "storeId", message: "Business accounts must be linked to a store you manage." });
    throwIfValidationIssues(issues);
    if (input.storeId !== null) {
      try {
        await storeAccess.assertStoreMember(userId, input.storeId, [StoreRole.OWNER, StoreRole.MANAGER]);
      } catch {
        throwIfValidationIssues([{ path: "storeId", message: "You can only link a store you own or manage." }]);
      }
      if ((await accounts.findAccountByStoreId(input.storeId)) !== undefined) throwIfValidationIssues([{ path: "storeId", message: "This store already has an ad account." }]);
    }
    const adminCount = (await accounts.listMembershipsForUser(userId)).filter((membership) => membership.role === "admin").length;
    if (adminCount >= MAXIMUM_ADMIN_ACCOUNTS) throwIfValidationIssues([{ path: "name", message: `You can administer at most ${MAXIMUM_ADMIN_ACCOUNTS} ad accounts.` }]);
    const account = await accounts.createAccountWithOwner(
      { name, kind: input.kind, ownerId: userId, storeId: input.storeId, countryCode: countryCode ?? "NG", currency: findCurrencyForCountry(countryCode).currency, timezone: input.timezone },
      clock.now(),
    );
    await this.access.recordActivity({ accountId: account.id, actorId: userId, objectType: "account", objectId: account.id, summary: "Created the ad account", changes: [] });
    return this.presentAccount(account, "admin");
  }

  public async findOrCreatePersonalAccount(userId: string, countryCode: string | null): Promise<AdAccountRecord> {
    const existing = await this.dependencies.accounts.findPersonalAccountForOwner(userId);
    if (existing !== undefined) return existing;
    const normalized = normalizeCountryCode(countryCode) ?? "NG";
    const contact = await this.dependencies.userDirectory.findUserContact(userId);
    return this.dependencies.accounts.createAccountWithOwner(
      { name: `${contact?.name ?? "My"} boosts`, kind: "personal", ownerId: userId, storeId: null, countryCode: normalized, currency: findCurrencyForCountry(normalized).currency, timezone: "Africa/Lagos" },
      this.dependencies.clock.now(),
    );
  }

  public async getAccount(userId: string, accountId: string) {
    const { account, member } = await this.access.requirePermission(userId, accountId, "account:view");
    return this.presentAccount(account, member.role);
  }

  public async updateAccount(userId: string, accountId: string, changes: { readonly name?: string; readonly timezone?: string }) {
    const { account, member } = await this.access.requirePermission(userId, accountId, "account:manage");
    const name = changes.name?.trim();
    if (name !== undefined && (name.length === 0 || name.length > 120)) throwIfValidationIssues([{ path: "name", message: "Name the ad account (up to 120 characters)." }]);
    const next = { ...(name === undefined ? {} : { name }), ...(changes.timezone === undefined ? {} : { timezone: changes.timezone }) };
    const updated = await this.dependencies.accounts.updateAccount(accountId, next, this.dependencies.clock.now());
    await this.access.recordActivity({ accountId, actorId: userId, objectType: "account", objectId: accountId, summary: "Updated account settings", changes: describeFieldChanges(account, next) });
    return this.presentAccount(updated, member.role);
  }

  public async readEntitlements(userId: string, accountId: string) {
    const { account } = await this.access.requirePermission(userId, accountId, "account:view");
    const profile = account.storeId === null
      ? await this.dependencies.entitlements.findEntitlementsForUser(account.ownerId)
      : await this.dependencies.entitlements.findEntitlementsForStore(account.storeId);
    const creditMinor = profile.entitlements["ads.monthly_credit_minor"];
    const goldPremium = profile.color === "GOLD" && profile.tier === "PREMIUM";
    return {
      goldPremium,
      verifiedBusiness: account.storeId !== null && (await this.isGoldVerified(account.storeId)),
      monthlyAdCredit: typeof creditMinor === "number" && creditMinor > 0 ? Money.of(creditMinor, account.currency).toDto() : null,
      creditRenewsAt: null,
    };
  }

  public async listMembers(userId: string, accountId: string) {
    const { account } = await this.access.requirePermission(userId, accountId, "account:view");
    const members = await this.dependencies.accounts.listMembers(accountId);
    return { items: await this.presentMembers(account, members) };
  }

  public async changeMemberRole(userId: string, accountId: string, memberUserId: string, role: AdAccountRole) {
    const { account } = await this.access.requirePermission(userId, accountId, "members:manage");
    const member = await this.dependencies.accounts.findMember(accountId, memberUserId);
    if (member === undefined) throw adsNotFound("Member");
    if (memberUserId === account.ownerId) throw adsConflict("OWNER_ROLE_LOCKED", "The owner's role cannot be changed.");
    const updated = await this.dependencies.accounts.changeMemberRole(accountId, memberUserId, role);
    await this.access.recordActivity({ accountId, actorId: userId, objectType: "member", objectId: memberUserId, summary: `Changed a member's role to ${role}`, changes: [{ field: "role", from: member.role, to: role }] });
    await this.dependencies.audit.record({ actorId: userId, action: "ads.member_role_changed", entityType: "ad_account", entityId: accountId, metadata: { memberUserId, role } });
    const [presented] = await this.presentMembers(account, [updated]);
    return presented;
  }

  public async removeMember(userId: string, accountId: string, memberUserId: string): Promise<void> {
    const { account } = await this.access.requirePermission(userId, accountId, "members:manage");
    if (memberUserId === account.ownerId) throw adsConflict("OWNER_CANNOT_BE_REMOVED", "The owner cannot be removed from the ad account.");
    if ((await this.dependencies.accounts.findMember(accountId, memberUserId)) === undefined) throw adsNotFound("Member");
    await this.dependencies.accounts.removeMember(accountId, memberUserId);
    await this.access.recordActivity({ accountId, actorId: userId, objectType: "member", objectId: memberUserId, summary: "Removed a member", changes: [] });
    await this.dependencies.audit.record({ actorId: userId, action: "ads.member_removed", entityType: "ad_account", entityId: accountId, metadata: { memberUserId } });
  }

  public async presentAccount(account: AdAccountRecord, role: AdAccountRole) {
    const summary = await this.presentSummary(account, role);
    const [owner] = await this.dependencies.userDirectory.findUserSummaries([account.ownerId]);
    const spent = (await this.dependencies.delivery.listBillingTransactions(account.id))
      .filter((transaction) => transaction.type === "ad_spend")
      .reduce((total, transaction) => total + Math.abs(transaction.amountMinor), 0);
    return {
      ...summary,
      createdAt: account.createdAt.toISOString(),
      owner: { id: account.ownerId, name: owner?.name ?? "" },
      amountSpent: Money.of(spent, account.currency).toDto(),
      disabledReason: account.disabledReason,
    };
  }

  private async presentSummary(account: AdAccountRecord, role: AdAccountRole) {
    const [stores, balance, campaigns] = await Promise.all([
      account.storeId === null ? [] : this.dependencies.storeAccess.findStoreSummaries([account.storeId]),
      this.readBalance(account),
      this.dependencies.campaigns.listCampaigns(account.id),
    ]);
    const business = stores[0] === undefined ? null : await this.presentBusinessProfile(stores[0]);
    return {
      id: account.id,
      name: account.name,
      kind: account.kind,
      currency: account.currency,
      timezone: account.timezone,
      countryCode: account.countryCode,
      status: account.status,
      myRole: role,
      verifiedBusiness: business?.goldVerified ?? false,
      business,
      balance,
      activeCampaignCount: campaigns.filter((campaign) => campaign.status === "active").length,
    };
  }

  private async readBalance(account: AdAccountRecord) {
    try {
      return (await this.dependencies.advertiserBilling.findAdvertiserWalletBalance(describeAdvertiser(account), account.currency)).toDto();
    } catch {
      return Money.zero(account.currency as CurrencyCode).toDto();
    }
  }

  private async isGoldVerified(storeId: string): Promise<boolean> {
    const badge = (await this.dependencies.verificationBadges.findVerificationBadges([storeId])).get(storeId);
    return badge !== undefined && badge.color === "GOLD" && badge.status === "VERIFIED";
  }

  private async presentBusinessProfile(store: StoreSummary) {
    return {
      storeId: store.id,
      storeName: store.name,
      handle: store.slug,
      logoUrl: store.logoUrl,
      goldVerified: await this.isGoldVerified(store.id),
      countryCode: CURRENCY_HOME_COUNTRY[store.currency] ?? "NG",
    };
  }

  private async presentMembers(account: AdAccountRecord, members: readonly AdAccountMemberRecord[]) {
    const users = new Map((await this.dependencies.userDirectory.findUserSummaries(members.map((member) => member.userId))).map((user) => [user.id, user]));
    return members.map((member) => ({
      userId: member.userId,
      name: users.get(member.userId)?.name ?? "",
      username: users.get(member.userId)?.username ?? "",
      avatarUrl: users.get(member.userId)?.avatarUrl ?? null,
      role: member.role,
      addedAt: member.addedAt.toISOString(),
      lastActiveAt: member.lastActiveAt?.toISOString() ?? null,
      isOwner: member.userId === account.ownerId,
    }));
  }
}

export const adAccountInactive = () => adsError(409, "AD_ACCOUNT_NOT_ACTIVE", "This ad account is not active.");
