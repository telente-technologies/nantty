import type { AccountSettings, ShippingAddressInput } from "@/types/account.type";
import type { Address } from "@/types";

import { useLocaleStore } from "@/store/locale.store";
import type { CountryOption } from "@/types/account.type";

import { getSignedInMockUser, me } from "./fixtures.mock";
import { buildAddressFromInput } from "./geo.mock";
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

const seedAddress = (id: string, overrides: Partial<ShippingAddressInput>): Address =>
  buildAddressFromInput(
    { fullName: "", phone: "", line1: "", postalCode: "", details: "", countryId: "ng", stateId: null, lgaId: null, cityId: null, isDefault: false, ...overrides },
    id,
  );

const addressesByUserId = new Map<string, Address[]>([
  [
    "u_me",
    [
      seedAddress("a_1", { fullName: "Temitope Adeyemi", phone: "+234 803 441 7720", line1: "14 Awolowo Avenue, Old Bodija", postalCode: "200001", stateId: "ng-oyo", lgaId: "ng-oyo-ibadan-north", cityId: "ng-oyo-ibadan-north-bodija", isDefault: true }),
      seedAddress("a_2", { fullName: "Temitope Adeyemi", phone: "+234 803 441 7720", line1: "23 Adeola Odeku Street", postalCode: "106104", details: "5th floor", stateId: "ng-lagos", lgaId: "ng-lagos-eti-osa", cityId: "ng-lagos-eti-osa-victoria-island" }),
    ],
  ],
  ["u_buyer", [seedAddress("a_3", { fullName: "Kemi Adekunle", phone: "+234 812 660 3149", line1: "7 Bode Thomas Street", postalCode: "101241", stateId: "ng-lagos", lgaId: "ng-lagos-surulere", cityId: "ng-lagos-surulere-surulere", isDefault: true })]],
]);

let addresses: Address[] = [];
const loadSignedInAddresses = () => {
  addresses = addressesByUserId.get(getSignedInMockUser().id) ?? [];
  return addresses;
};
export const findSignedInAddress = (addressId: string) => loadSignedInAddresses().find((a) => a.id === addressId);
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

const viewerThemePreference = { current: "system" };

export const settingsMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/locale/countries", () => ({ data: SUPPORTED_COUNTRIES, nextCursor: null })),
  createMockRoute("PATCH", "/api/v1/users/me/preferences", ({ body }) => {
    const { countryCode, theme } = body as { countryCode?: string; theme?: string };
    if (theme) viewerThemePreference.current = theme;
    if (!countryCode) return;
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
  createMockRoute("GET", "/api/v1/users/me/addresses", () => ({ data: loadSignedInAddresses(), nextCursor: null })),
  createMockRoute("POST", "/api/v1/users/me/addresses", ({ body }) => {
    loadSignedInAddresses();
    const address = buildAddressFromInput(body as ShippingAddressInput, `a_${Date.now()}`);
    addresses = [...addresses, address];
    applyDefaultAddress(address.id, address.isDefault);
    saveSignedInAddresses();
    return address;
  }),
  createMockRoute("PATCH", "/api/v1/users/me/addresses/:addressId", ({ params, body }) => {
    loadSignedInAddresses();
    addresses = addresses.map((a) => (a.id === params.addressId ? buildAddressFromInput(body as ShippingAddressInput, a.id) : a));
    applyDefaultAddress(params.addressId!, (body as ShippingAddressInput).isDefault);
    saveSignedInAddresses();
    return addresses.find((a) => a.id === params.addressId);
  }),
  createMockRoute("DELETE", "/api/v1/users/me/addresses/:addressId", ({ params }) => {
    addresses = loadSignedInAddresses().filter((a) => a.id !== params.addressId);
    saveSignedInAddresses();
  }),
];
