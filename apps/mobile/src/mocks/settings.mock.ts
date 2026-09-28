import type { AccountSettings, ShippingAddressInput } from "@/types/account.type";
import type { Address } from "@/types";

import { me } from "./fixtures.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";

let settings: AccountSettings = {
  email: me.email ?? "testzudomart@yahoo.com",
  phone: null,
  theme: "light",
  language: "en",
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

export const settingsMocks: MockRoute[] = [
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
