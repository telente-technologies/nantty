import type { AccountSettings, CountryOption, ShippingAddressInput, UsernamePolicy } from "@/types/account.type";
import type { Address, Clip, FollowState, Page, Post, User } from "@/types";

// Follows live in the social service; user profiles do not carry the viewer's follow state or a fresh follower count.
export interface FollowStatus {
  readonly state: FollowState;
  readonly followedBy: boolean;
  readonly followersCount: number;
  readonly followingCount: number;
  readonly viewerPostNotifications: "off" | "posts" | "posts_and_lives";
}

import { sendRequestToWebappServer, sendListRequestToWebappServer } from "./clientApi.service";

export interface ProfileDetailsUpdate {
  readonly name?: string;
  readonly bio?: string;
  readonly avatarMediaId?: string | null;
  readonly bannerMediaId?: string | null;
  readonly isPrivate?: boolean;
}

const withDisplayNameFallback = (user: User): User => (user.name ? user : { ...user, name: user.username });

export const usersService = {
  fetchMyProfile: () => sendRequestToWebappServer<User>("/api/v1/users/me").then(withDisplayNameFallback),
  fetchUserProfileById: (userId: string) => sendRequestToWebappServer<User>(`/api/v1/users/${userId}`),
  fetchFollowStatus: (userId: string) => sendRequestToWebappServer<FollowStatus>(`/api/v1/users/${encodeURIComponent(userId)}/follow-status`),
  fetchUserIdByUsername: (username: string) => sendRequestToWebappServer<{ id: string }>(`/api/v1/users/by-username/${encodeURIComponent(username)}`),
  fetchPostsByUserId: (userId: string, cursor?: string) =>
    sendRequestToWebappServer<Page<Post>>(`/api/v1/users/${encodeURIComponent(userId)}/posts`, { query: { cursor } }),
  fetchClipsByUserId: (userId: string, cursor?: string) =>
    sendRequestToWebappServer<Page<Clip>>(`/api/v1/users/${encodeURIComponent(userId)}/posts`, { query: { kind: "clip", cursor } }),
  updateMyProfileDetails: (update: ProfileDetailsUpdate) => sendRequestToWebappServer<User>("/api/v1/users/me", { method: "PATCH", body: update }),
  updateMyCountryPreference: (countryCode: string) => sendRequestToWebappServer<void>("/api/v1/users/me/preferences", { method: "PATCH", body: { countryCode } }),
  listSupportedCountries: () => sendListRequestToWebappServer<CountryOption>("/api/v1/locale/countries"),
  deactivateMyAccount: () => sendRequestToWebappServer<void>("/api/v1/users/me/deactivate", { method: "POST" }),
  changeMyPassword: (currentPassword: string, newPassword: string) =>
    sendRequestToWebappServer<void>("/api/v1/auth/password/change", { method: "POST", body: { currentPassword, newPassword } }),
  listMyShippingAddresses: () => sendListRequestToWebappServer<Address>("/api/v1/users/me/addresses"),
  createShippingAddress: (input: ShippingAddressInput) => sendRequestToWebappServer<Address>("/api/v1/users/me/addresses", { method: "POST", body: input }),
  updateShippingAddress: (addressId: string, input: ShippingAddressInput) =>
    sendRequestToWebappServer<Address>(`/api/v1/users/me/addresses/${addressId}`, { method: "PATCH", body: input }),
  deleteShippingAddress: (addressId: string) => sendRequestToWebappServer<void>(`/api/v1/users/me/addresses/${addressId}`, { method: "DELETE" }),
  fetchMyUsernamePolicy: () => sendRequestToWebappServer<UsernamePolicy>("/api/v1/users/me/username-policy"),
  fetchMyAccountSettings: () => sendRequestToWebappServer<AccountSettings>("/api/v1/users/me/settings"),
  updateMyAccountSettings: (update: Partial<AccountSettings>) => sendRequestToWebappServer<AccountSettings>("/api/v1/users/me/settings", { method: "PATCH", body: update }),
  changeMyUsername: (username: string) => sendRequestToWebappServer<User>("/api/v1/users/me/username", { method: "PATCH", body: { username } }),
};
