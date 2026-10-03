import type { AccountSettings, CountryOption, ShippingAddressInput, UsernameAvailability, UsernamePolicy } from "@/types/account.type";
import type { Address, Page, Post, User } from "@/types";

import { api } from "./apiClient.service";

export interface ProfileDetailsUpdate {
  readonly name?: string;
  readonly bio?: string;
  readonly avatarMediaId?: string | null;
  readonly bannerMediaId?: string | null;
  readonly isPrivate?: boolean;
}

const withDisplayNameFallback = (user: User): User => (user.name ? user : { ...user, name: user.username });

export const usersService = {
  fetchMyProfile: () => api.get<User>("/api/v1/users/me").then(withDisplayNameFallback),
  fetchUserProfileById: (userId: string) => api.get<User>(`/api/v1/users/${encodeURIComponent(userId)}`).then(withDisplayNameFallback),
  fetchUserIdByUsername: (username: string) => api.get<{ id: string }>(`/api/v1/users/by-username/${encodeURIComponent(username)}`),
  fetchPostsByUserId: (userId: string, cursor?: string) =>
    api.get<Page<Post>>(`/api/v1/users/${encodeURIComponent(userId)}/posts`, { cursor }),
  updateMyProfileDetails: (update: ProfileDetailsUpdate) => api.patch<User>("/api/v1/users/me", update),
  fetchMyAccountSettings: () => api.get<AccountSettings>("/api/v1/users/me/settings"),
  updateMyAccountSettings: (update: Partial<AccountSettings>) => api.patch<AccountSettings>("/api/v1/users/me/settings", update),
  updateMyCountryPreference: (countryCode: string) => api.patch<void>("/api/v1/users/me/preferences", { countryCode }),
  updateMyThemePreference: (theme: AccountSettings["theme"]) => api.patch<void>("/api/v1/users/me/preferences", { theme }),
  listSupportedCountries: () => api.getList<CountryOption>("/api/v1/locale/countries"),
  deactivateMyAccount: () => api.post<void>("/api/v1/users/me/deactivate"),
  changeMyPassword: (currentPassword: string, newPassword: string) =>
    api.post<void>("/api/v1/auth/password/change", { currentPassword, newPassword }),
  listMyShippingAddresses: () => api.getList<Address>("/api/v1/users/me/addresses"),
  createShippingAddress: (input: ShippingAddressInput) => api.post<Address>("/api/v1/users/me/addresses", input),
  updateShippingAddress: (addressId: string, input: ShippingAddressInput) =>
    api.patch<Address>(`/api/v1/users/me/addresses/${encodeURIComponent(addressId)}`, input),
  deleteShippingAddress: (addressId: string) => api.delete<void>(`/api/v1/users/me/addresses/${encodeURIComponent(addressId)}`),
  checkUsernameAvailability: (username: string) => api.get<UsernameAvailability>("/api/v1/auth/username-available", { username }),
  fetchSuggestedUsername: (seed: string) => api.get<{ username: string }>("/api/v1/auth/username-suggestion", { seed }),
  fetchMyUsernamePolicy: () => api.get<UsernamePolicy>("/api/v1/users/me/username-policy"),
  changeMyUsername: (username: string) => api.patch<User>("/api/v1/users/me/username", { username }),
};
