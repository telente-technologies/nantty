import type { CountryOption, ShippingAddressInput } from "@/types/account.type";
import type { Address, Page, Post, User } from "@/types";

import { sendRequestToWebappServer, sendListRequestToWebappServer } from "./clientApi.service";

export interface ProfileDetailsUpdate {
  readonly name?: string;
  readonly bio?: string;
  readonly avatarMediaId?: string | null;
  readonly bannerMediaId?: string | null;
}

const withDisplayNameFallback = (user: User): User => (user.name ? user : { ...user, name: user.username });

export const usersService = {
  fetchMyProfile: () => sendRequestToWebappServer<User>("/api/v1/users/me").then(withDisplayNameFallback),
  fetchUserProfileById: (userId: string) => sendRequestToWebappServer<User>(`/api/v1/users/${userId}`),
  fetchUserIdByUsername: (username: string) => sendRequestToWebappServer<{ id: string }>(`/api/v1/users/by-username/${encodeURIComponent(username)}`),
  fetchPostsByUserId: (userId: string, cursor?: string) =>
    sendRequestToWebappServer<Page<Post>>(`/api/v1/users/${userId}/posts`, { query: { cursor } }),
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
  fetchMyUsernamePolicy: () => sendRequestToWebappServer<{ minLength: number; maxLength: number }>("/api/v1/users/me/username-policy"),
  changeMyUsername: (username: string) => sendRequestToWebappServer<User>("/api/v1/users/me/username", { method: "PATCH", body: { username } }),
};
