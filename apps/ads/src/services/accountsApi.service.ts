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
import type { ActivityEntry, ActivityObjectType } from "@/types/tools.type";

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
  listActivity: (accountId: string, filters: { objectType?: ActivityObjectType | ""; cursor?: string | null }) =>
    sendAdsApiRequest<Page<ActivityEntry>>(buildAccountApiPath(accountId, "/activity"), { query: { objectType: filters.objectType, cursor: filters.cursor, limit: 30 } }),
};
