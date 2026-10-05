import { buildAccountApiPath, sendAdsApiRequest, sendRequestToAdsManagerServer } from "@/services/adsApiClient.service";
import type {
  AdAccount,
  AdAccountInvite,
  AdAccountMember,
  AdAccountRole,
  AdAccountSummary,
  AdsEntitlements,
  CreateAdAccountRequest,
  InvitePreview,
  LinkedBusinessProfile,
  UpdateAdAccountRequest,
} from "@/types/adAccount.type";
import type { Page } from "@/types/api.type";
import type { Money } from "@/types/money.type";
import type { ActivityChange, ActivityEntry, ActivityEntryResponse, ActivityObjectType } from "@/types/tools.type";
import { formatMoneyForDisplay } from "@/utils/money.util";

const systemActorName = "System";

function describeChangedValue(value: unknown): string | null {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object" && value !== null && "amountMinor" in value && "currency" in value) return formatMoneyForDisplay(value as Money);
  return null;
}

function convertActivityChanges(changes: unknown): ActivityChange[] {
  if (typeof changes !== "object" || changes === null || Array.isArray(changes)) return [];
  return Object.entries(changes).flatMap(([field, value]) => {
    const described = describeChangedValue(value);
    return described === null ? [] : [{ field, from: null, to: described }];
  });
}

function convertActivityEntry(entry: ActivityEntryResponse): ActivityEntry {
  return {
    id: entry.id,
    actor: { id: "", name: entry.actor, isSystem: entry.actor === systemActorName },
    action: "",
    objectType: entry.objectType,
    objectId: entry.objectId,
    objectName: "",
    summary: entry.summary,
    changes: convertActivityChanges(entry.changes),
    createdAt: entry.createdAt,
  };
}

export const accountsApi = {
  signInWithPassword: (identifier: string, password: string, nextPath: string | null) =>
    sendRequestToAdsManagerServer<{ redirectTo: string }>("/bff/auth/login", { method: "POST", body: { identifier, password, next: nextPath } }),
  signOut: () => sendRequestToAdsManagerServer<{ redirectTo: string }>("/bff/auth/logout", { method: "POST" }),
  listMyAdAccounts: () => sendAdsApiRequest<{ items: AdAccountSummary[] }>("/ads/accounts"),
  createAdAccount: (request: CreateAdAccountRequest, idempotencyKey: string) => sendAdsApiRequest<AdAccount>("/ads/accounts", { method: "POST", body: request, idempotencyKey }),
  listLinkableBusinessProfiles: () => sendAdsApiRequest<{ items: LinkedBusinessProfile[] }>("/ads/business-profiles"),
  fetchAdAccount: (accountId: string) => sendAdsApiRequest<AdAccount>(buildAccountApiPath(accountId)),
  updateAdAccount: (accountId: string, changes: UpdateAdAccountRequest) => sendAdsApiRequest<AdAccount>(buildAccountApiPath(accountId), { method: "PATCH", body: changes }),
  fetchEntitlements: (accountId: string) => sendAdsApiRequest<AdsEntitlements>(buildAccountApiPath(accountId, "/entitlements")),
  listMembers: (accountId: string) => sendAdsApiRequest<{ items: AdAccountMember[] }>(buildAccountApiPath(accountId, "/members")),
  changeMemberRole: (accountId: string, userId: string, role: AdAccountRole) =>
    sendAdsApiRequest<AdAccountMember>(buildAccountApiPath(accountId, `/members/${encodeURIComponent(userId)}`), { method: "PATCH", body: { role } }),
  removeMember: (accountId: string, userId: string) => sendAdsApiRequest<void>(buildAccountApiPath(accountId, `/members/${encodeURIComponent(userId)}`), { method: "DELETE" }),
  listInvites: (accountId: string) => sendAdsApiRequest<{ items: AdAccountInvite[] }>(buildAccountApiPath(accountId, "/invites")),
  sendInvite: (accountId: string, email: string, role: AdAccountRole) => sendAdsApiRequest<AdAccountInvite>(buildAccountApiPath(accountId, "/invites"), { method: "POST", body: { email, role } }),
  revokeInvite: (accountId: string, inviteId: string) => sendAdsApiRequest<void>(buildAccountApiPath(accountId, `/invites/${encodeURIComponent(inviteId)}`), { method: "DELETE" }),
  previewInvite: (token: string) => sendAdsApiRequest<InvitePreview>(`/ads/invites/${encodeURIComponent(token)}`),
  acceptInvite: (token: string) => sendAdsApiRequest<{ accountId: string }>(`/ads/invites/${encodeURIComponent(token)}/accept`, { method: "POST" }),
  listActivity: async (accountId: string, filters: { objectType?: ActivityObjectType | ""; cursor?: string | null }): Promise<Page<ActivityEntry>> => {
    const page = await sendAdsApiRequest<Page<ActivityEntryResponse>>(buildAccountApiPath(accountId, "/activity"), { query: { objectType: filters.objectType, cursor: filters.cursor, limit: 30 } });
    return { ...page, items: page.items.map(convertActivityEntry) };
  },
};
