import type { AccountSettings, ShippingAddressInput } from "@/types/account.type";
import type { Address } from "@/types";

import { useLocaleStore } from "@/store/locale.store";
import type { CountryOption } from "@/types/account.type";

import { me } from "./fixtures.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";

let settings: AccountSettings = {
  email: me.email ?? "testzudomart@yahoo.com",
  phone: null,
  theme: "light",
  language: "en",
  countryCode: null,
  pushNotificationsEnabled: true,
  twoFactorEnabled: false,
};

let addresses: Address[] = [
  {
    id: "a_1",
    fullName: "Enyo Dev",
    phone: "+234 907 750 5722",
    line1: "12 Admiralty Way, Lekki Phase 1",
    city: "Lekki",
    state: "Lagos",
    isDefault: true,
  },
];

const applyDefaultAddress = (id: string, isDefault: boolean) => {
  if (isDefault) addresses = addresses.map((a) => ({ ...a, isDefault: a.id === id }));
};

const SUPPORTED_COUNTRIES: CountryOption[] = [
  { countryCode: "NG", countryName: "Nigeria", currency: "NGN", currencyName: "Nigerian naira" },
  { countryCode: "GH", countryName: "Ghana", currency: "GHS", currencyName: "Ghanaian cedi" },
  { countryCode: "KE", countryName: "Kenya", currency: "KES", currencyName: "Kenyan shilling" },
  { countryCode: "ZA", countryName: "South Africa", currency: "ZAR", currencyName: "South African rand" },
  { countryCode: "GB", countryName: "United Kingdom", currency: "GBP", currencyName: "British pound" },
  { countryCode: "IE", countryName: "Ireland", currency: "EUR", currencyName: "Euro" },
  { countryCode: "US", countryName: "United States", currency: "USD", currencyName: "US dollar" },
];

export const settingsMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/locale/countries", () => SUPPORTED_COUNTRIES),
  createMockRoute("PATCH", "/api/v1/users/me/preferences", ({ body }) => {
    const { countryCode } = body as { countryCode: string };
    settings = { ...settings, countryCode };
    useLocaleStore.setState({ deviceRegionCode: countryCode });
  }),
  createMockRoute("GET", "/api/v1/users/me/settings", () => settings),
  createMockRoute("PATCH", "/api/v1/users/me/settings", ({ body }) => {
    settings = { ...settings, ...(body as Partial<AccountSettings>) };
    return settings;
  }),
  createMockRoute("POST", "/api/v1/users/me/deactivate", () => undefined),
  createMockRoute("POST", "/api/v1/auth/password/change", () => undefined),
  createMockRoute("GET", "/api/v1/users/me/addresses", () => addresses),
  createMockRoute("POST", "/api/v1/users/me/addresses", ({ body }) => {
    const address: Address = { ...(body as ShippingAddressInput), id: `a_${Date.now()}` };
    addresses = [...addresses, address];
    applyDefaultAddress(address.id, address.isDefault);
    return address;
  }),
  createMockRoute("PATCH", "/api/v1/users/me/addresses/:addressId", ({ params, body }) => {
    addresses = addresses.map((a) => (a.id === params.addressId ? { ...a, ...(body as ShippingAddressInput) } : a));
    applyDefaultAddress(params.addressId!, (body as ShippingAddressInput).isDefault);
    return addresses.find((a) => a.id === params.addressId);
  }),
  createMockRoute("DELETE", "/api/v1/users/me/addresses/:addressId", ({ params }) => {
    addresses = addresses.filter((a) => a.id !== params.addressId);
  }),
];
