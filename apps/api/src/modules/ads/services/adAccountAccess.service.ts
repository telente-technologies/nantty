import { adAccountNotFound, adsForbidden } from "../../../errors/ads.error.js";
import { AD_ACCOUNT_ROLE_PERMISSIONS, type AdAccountMemberRecord, type AdAccountPermission, type AdAccountRecord, type NewAdActivityInput } from "../models/adAccounts.model.js";
import type { AdsDependencies } from "../models/adsDependencies.model.js";

export interface AccountAccess {
  readonly account: AdAccountRecord;
  readonly member: AdAccountMemberRecord;
}

export class AdAccountAccess {
  public constructor(private readonly dependencies: AdsDependencies) {}

  public async requirePermission(userId: string, accountId: string, permission: AdAccountPermission): Promise<AccountAccess> {
    const { accounts, clock } = this.dependencies;
    const [account, member] = await Promise.all([accounts.findAccountById(accountId), accounts.findMember(accountId, userId)]);
    if (account === undefined || member === undefined) throw adAccountNotFound();
    if (!AD_ACCOUNT_ROLE_PERMISSIONS[member.role].has(permission)) throw adsForbidden();
    await accounts.touchMember(accountId, userId, clock.now());
    return { account, member };
  }

  public async recordActivity(entry: Omit<NewAdActivityInput, "createdAt" | "actorLabel"> & { readonly actorLabel?: string }): Promise<void> {
    await this.dependencies.invites.recordActivity({ ...entry, actorLabel: entry.actorLabel ?? (entry.actorId === null ? "System" : "Member"), createdAt: this.dependencies.clock.now() });
  }
}

export function describeFieldChanges<T extends object>(before: T, after: Partial<T>): { field: string; from: unknown; to: unknown }[] {
  return Object.entries(after)
    .filter(([field, value]) => value !== undefined && JSON.stringify((before as Record<string, unknown>)[field]) !== JSON.stringify(value))
    .map(([field, value]) => ({ field, from: (before as Record<string, unknown>)[field] ?? null, to: value }));
}

export interface AdsPage<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
  readonly total: number;
}

export function paginateAdsItems<T>(items: readonly T[], cursor: string | undefined, limit: number): AdsPage<T> {
  const start = cursor === undefined ? 0 : Math.max(0, Number.parseInt(Buffer.from(cursor, "base64url").toString("utf8"), 10) || 0);
  const pageItems = items.slice(start, start + limit);
  const next = start + limit;
  return { items: pageItems, nextCursor: next < items.length ? Buffer.from(String(next)).toString("base64url") : null, total: items.length };
}
