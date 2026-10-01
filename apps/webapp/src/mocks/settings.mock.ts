import type { AccountSettings, ShippingAddressInput } from "@/types/account.type";
import type { Address } from "@/types";

import { useLocaleStore } from "@/store/locale.store";
import type { CountryOption } from "@/types/account.type";

import { getSignedInMockUser, me } from "./fixtures.mock";
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

const addressesByUserId = new Map<string, Address[]>([
  [
    "u_me",
    [
      { id: "a_1", fullName: "Temitope Adeyemi", phone: "+234 803 441 7720", line1: "14 Awolowo Avenue, Old Bodija", city: "Ibadan", state: "Oyo", isDefault: true },
      { id: "a_2", fullName: "Temitope Adeyemi", phone: "+234 803 441 7720", line1: "5th Floor, 23 Adeola Odeku Street, Victoria Island", city: "Lagos", state: "Lagos", isDefault: false },
    ],
  ],
  ["u_buyer", [{ id: "a_3", fullName: "Kemi Adekunle", phone: "+234 812 660 3149", line1: "7 Bode Thomas Street", city: "Surulere", state: "Lagos", isDefault: true }]],
]);

let addresses: Address[] = [];
const loadSignedInAddresses = () => {
  addresses = addressesByUserId.get(getSignedInMockUser().id) ?? [];
  return addresses;
};
const saveSignedInAddresses = () => addressesByUserId.set(getSignedInMockUser().id, addresses);

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
  createMockRoute("GET", "/api/v1/users/me/settings", () => ({ ...settings, email: getSignedInMockUser().email ?? settings.email, phone: settings.phone ?? getSignedInMockUser().phone ?? null })),
  createMockRoute("PATCH", "/api/v1/users/me/settings", ({ body }) => {
    settings = { ...settings, ...(body as Partial<AccountSettings>) };
    return settings;
  }),
  createMockRoute("POST", "/api/v1/users/me/deactivate", () => undefined),
  createMockRoute("POST", "/api/v1/auth/password/change", () => undefined),
  createMockRoute("GET", "/api/v1/users/me/addresses", () => loadSignedInAddresses()),
  createMockRoute("POST", "/api/v1/users/me/addresses", ({ body }) => {
    loadSignedInAddresses();
    const address: Address = { ...(body as ShippingAddressInput), id: `a_${Date.now()}` };
    addresses = [...addresses, address];
    applyDefaultAddress(address.id, address.isDefault);
    saveSignedInAddresses();
    return address;
  }),
  createMockRoute("PATCH", "/api/v1/users/me/addresses/:addressId", ({ params, body }) => {
    loadSignedInAddresses();
    addresses = addresses.map((a) => (a.id === params.addressId ? { ...a, ...(body as ShippingAddressInput) } : a));
    applyDefaultAddress(params.addressId!, (body as ShippingAddressInput).isDefault);
    saveSignedInAddresses();
    return addresses.find((a) => a.id === params.addressId);
  }),
  createMockRoute("DELETE", "/api/v1/users/me/addresses/:addressId", ({ params }) => {
    addresses = loadSignedInAddresses().filter((a) => a.id !== params.addressId);
    saveSignedInAddresses();
  }),
];
