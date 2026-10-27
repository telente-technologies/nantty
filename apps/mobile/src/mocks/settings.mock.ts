import type { AccountSettings, ShippingAddressInput } from "@/types/account.type";
import type { Address } from "@/types";

import { useLocaleStore } from "@/store/locale.store";
import type { CountryOption } from "@/types/account.type";

import { getSignedInMockUser, me } from "./fixtures.mock";
import { buildAddressFromInput } from "./geo.mock";
import { createMockRoute, mockPage, type MockRoute } from "./registry.mock";

let settings: AccountSettings = {
  email: me.email ?? "testnantty@yahoo.com",
  phone: null,
  theme: "light",
  language: "en",
  countryCode: null,
  pushNotificationsEnabled: true,
  twoFactorEnabled: false,
};

const seedAddress = (id: string, fullName: string, phone: string, line1: string, areaPath: [string, string, string], isDefault: boolean): Address =>
  buildAddressFromInput(
    { fullName, phone, line1, postalCode: "", details: "", isDefault, countryId: "ng", stateId: areaPath[0], lgaId: areaPath[1], cityId: areaPath[2] },
    id,
  );

const addressesByUserId = new Map<string, Address[]>([
  [
    "u_me",
    [
      seedAddress("a_1", "Temitope Adeyemi", "+234 803 441 7720", "14 Awolowo Avenue", ["ng-oyo", "ng-oyo-ibadan-north", "ng-oyo-ibadan-north-bodija"], true),
      seedAddress("a_2", "Temitope Adeyemi", "+234 803 441 7720", "23 Adeola Odeku Street", ["ng-lagos", "ng-lagos-eti-osa", "ng-lagos-eti-osa-victoria-island"], false),
      seedAddress("a_4", "Temitope Adeyemi", "+234 803 441 7720", "9 Ogunlana Drive", ["ng-ogun", "ng-ogun-abeokuta-south", "ng-ogun-abeokuta-south-abeokuta"], false),
    ],
  ],
  ["u_buyer", [seedAddress("a_3", "Kemi Adekunle", "+234 812 660 3149", "7 Bode Thomas Street", ["ng-lagos", "ng-lagos-surulere", "ng-lagos-surulere-surulere"], true)]],
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

export const findSignedInAddress = (addressId: string) => loadSignedInAddresses().find((address) => address.id === addressId);

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
  createMockRoute("GET", "/api/v1/locale/countries", () => mockPage(SUPPORTED_COUNTRIES)),
  createMockRoute("PATCH", "/api/v1/users/me/preferences", ({ body }) => {
    const { countryCode, theme } = body as { countryCode?: string; theme?: AccountSettings["theme"] };
    if (theme) settings = { ...settings, theme };
    if (countryCode === undefined) return;
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
  createMockRoute("GET", "/api/v1/users/me/addresses", () => mockPage(loadSignedInAddresses())),
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
    const updated = buildAddressFromInput(body as ShippingAddressInput, params.addressId!);
    addresses = addresses.map((a) => (a.id === params.addressId ? updated : a));
    applyDefaultAddress(params.addressId!, (body as ShippingAddressInput).isDefault);
    saveSignedInAddresses();
    return addresses.find((a) => a.id === params.addressId);
  }),
  createMockRoute("DELETE", "/api/v1/users/me/addresses/:addressId", ({ params }) => {
    addresses = loadSignedInAddresses().filter((a) => a.id !== params.addressId);
    saveSignedInAddresses();
  }),
];
