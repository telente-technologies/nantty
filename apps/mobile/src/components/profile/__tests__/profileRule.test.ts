import mockAsyncStorage from "@react-native-async-storage/async-storage/jest/async-storage-mock";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { Text } from "react-native";
import { act, fireEvent, render, screen } from "@testing-library/react-native";

import { BrandSellingSwitch } from "@/components/brand/brandSellingSwitch";
import { ProfileLimitGate } from "@/components/profile/profileLimitGate";
import { ManageProfilesScreen } from "@/screens/brand/manageProfiles.screen";
import { brandsService } from "@/services/sellers/brands.service";
import type { BrandDetail, LinkedProfiles } from "@/types/brand.type";
import { showAlertWithButtons } from "@/utils/crossPlatformAlert.util";

let mockLinked: LinkedProfiles;

jest.mock("@react-native-async-storage/async-storage", () => mockAsyncStorage);
jest.mock("@/store/offline.store", () => {
  const { create } = jest.requireActual("zustand");
  const useOfflineStore = create(() => ({ isOnline: true, queuedMutations: [] }));
  return { useOfflineStore, isDeviceConnectedAccordingToNetInfo: (state: { isConnected?: boolean }) => state.isConnected !== false };
});

jest.mock("@/hooks/useLinkedProfiles.hook", () => ({
  linkedProfilesQueryKey: ["users", "me", "linked-profiles"],
  useLinkedProfiles: () => ({ isPending: false, isError: false, data: mockLinked, refetch: jest.fn() }),
}));
jest.mock("@/components/settings/settingsPage", () => ({ SettingsPage: ({ children }: { children: ReactNode }) => children }));
jest.mock("@/components/wallet/stepUpSheet", () => ({ useStepUpPrompt: () => ({ withStepUp: (action: (token: string) => Promise<unknown>) => action("step-up-token"), stepUpSheet: null }) }));
jest.mock("@/utils/crossPlatformAlert.util", () => ({ showAlertWithButtons: jest.fn() }));
jest.mock("@/hooks/useReducedMotionPreference.hook", () => ({ useReducedMotionPreference: () => true }));
jest.mock("@react-native-community/netinfo", () => ({ __esModule: true, default: { refresh: jest.fn(async () => ({ isConnected: true })), addEventListener: jest.fn() } }));
jest.mock("expo-clipboard", () => ({ setStringAsync: jest.fn(async () => true) }));
jest.mock("react-native-safe-area-context", () => {
  const { View } = jest.requireActual("react-native");
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock("react-native-reanimated", () => {
  const { View } = jest.requireActual("react-native");
  const identity = (value: unknown) => value;
  return { __esModule: true, default: { View }, Easing: { inOut: () => undefined, sin: undefined }, cancelAnimation: () => undefined, useSharedValue: (value: number) => ({ value }), useAnimatedStyle: (factory: () => object) => factory(), withTiming: identity, withRepeat: identity, withDelay: (_: number, value: unknown) => value, withSequence: (...values: unknown[]) => values[0] };
});

const item = (kind: "store" | "business" | "brand", status: "active" | "held" = "active", premiumNeeded = false) => ({ kind, profileId: `${kind}-${status}`, storeId: kind === "store" ? "store-1" : null, status, holdReason: null, name: `My ${kind}`, handle: kind, showsMart: kind === "store", ownsStore: kind === "store", premiumNeeded });
const summary = (items: LinkedProfiles["items"]): LinkedProfiles => {
  const active = items.filter((entry) => entry.status === "active");
  const slot = active.some((entry) => entry.kind !== "brand");
  return {
    accountId: "me", items, canCreate: { store: !slot, business: !slot, brand: !active.some((entry) => entry.kind === "brand") }, choiceRequired: items.some((entry) => entry.status === "held"),
    businessProfiles: { count: active.length, limit: 2, premiumLimit: 5, premium: false, premiumNeeded: false, storeUsed: active.some((entry) => entry.ownsStore) },
  };
};
const premiumSummary = (items: LinkedProfiles["items"], premium = true): LinkedProfiles => {
  const count = items.filter((entry) => entry.status === "active").length;
  const storeUsed = items.some((entry) => entry.ownsStore);
  const premiumNeeded = items.some((entry) => entry.premiumNeeded);
  const room = premium && count < 5;
  return {
    accountId: "me", items, canCreate: { store: room && !storeUsed, business: room, brand: room }, choiceRequired: false,
    businessProfiles: { count, limit: premium ? 5 : 2, premiumLimit: 5, premium, premiumNeeded, storeUsed },
  };
};
const withQueryClient = (element: ReturnType<typeof createElement>) => createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { mutations: { retry: false } } }) }, element);
const navigation = { navigate: jest.fn() };
const renderManageProfiles = () => render(withQueryClient(createElement(ManageProfilesScreen, { navigation, route: { key: "ManageProfiles", name: "ManageProfiles" } } as never)));

describe("Store or Business choice", () => {
  beforeEach(() => navigation.navigate.mockClear());

  it("offers both options and explains you can only have one", async () => {
    mockLinked = summary([]);
    await renderManageProfiles();
    expect(screen.getByText("Open a store")).toBeTruthy();
    expect(screen.getByText("Create a Business page")).toBeTruthy();
    expect(screen.getByText(/one Store or one Business page, never both/)).toBeTruthy();
    fireEvent.press(screen.getByText("Create a Business page"));
    expect(navigation.navigate).toHaveBeenCalledWith("CreateBusinessProfile");
  });

  it("hides the other option once a Store exists, and hides Create a brand once a Brand exists", async () => {
    mockLinked = summary([item("store"), item("brand")]);
    await renderManageProfiles();
    expect(screen.getByText("You already have a Store")).toBeTruthy();
    expect(screen.queryByText("Create a Business page")).toBeNull();
    expect(screen.queryByText("Open a store")).toBeNull();
    expect(screen.getByText("You already have a Brand")).toBeTruthy();
    expect(screen.queryByText("Create a brand")).toBeNull();
  });

  it("asks a grandfathered account to choose which to keep", async () => {
    mockLinked = summary([item("store"), item("business", "held")]);
    await renderManageProfiles();
    expect(screen.getByText("Keep selected profiles")).toBeTruthy();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
  });
});

describe("blocked create flows", () => {
  it("shows the centred profile limit screen with Manage profiles for a deep link into a blocked flow", async () => {
    mockLinked = summary([item("store")]);
    await render(createElement(ProfileLimitGate, { kind: "business" }, createElement(Text, null, "form")));
    expect(screen.queryByText("form")).toBeNull();
    expect(screen.getByText("You can have one Store or one Business page")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Manage profiles" })).toBeTruthy();
  });

  it("lets the create flow through when the slot is free", async () => {
    mockLinked = summary([item("brand")]);
    await render(createElement(ProfileLimitGate, { kind: "business" }, createElement(Text, null, "form")));
    expect(screen.getByText("form")).toBeTruthy();
  });

  it("blocks a second brand and anything while profiles are on hold", async () => {
    mockLinked = summary([item("brand")]);
    await render(createElement(ProfileLimitGate, { kind: "brand" }, createElement(Text, null, "form")));
    expect(screen.getByText("You already have a Brand")).toBeTruthy();
    mockLinked = summary([item("store"), item("business", "held")]);
    await render(createElement(ProfileLimitGate, { kind: "brand" }, createElement(Text, null, "form")));
    expect(screen.getByText("Choose which profiles to keep")).toBeTruthy();
  });
});

describe("Blue Premium business profiles", () => {
  it("shows the Premium allowance, the Store badge and lets a Premium owner add a Business page next to the store", async () => {
    mockLinked = premiumSummary([item("store"), { ...item("business"), profileId: "business-2" }, item("brand")]);
    await renderManageProfiles();
    expect(screen.getByText("3 of 5 business profiles (Premium)")).toBeTruthy();
    expect(screen.getByText("Store")).toBeTruthy();
    expect(screen.queryByText("Open a store")).toBeNull();
    fireEvent.press(screen.getByText("Create a Business page"));
    expect(navigation.navigate).toHaveBeenCalledWith("CreateBusinessProfile");
  });

  it("tells a Premium owner at 5 profiles they've reached the limit, without an upsell", async () => {
    mockLinked = premiumSummary([item("store"), ...["a", "b", "c", "d"].map((suffix) => ({ ...item("business"), profileId: `business-${suffix}` }))]);
    await renderManageProfiles();
    expect(screen.getByText("5 of 5 business profiles (Premium)")).toBeTruthy();
    expect(screen.getByText(/You've reached the 5 business profiles Blue Premium includes/)).toBeTruthy();
    expect(screen.queryByText("Get Blue Premium for up to 5 business profiles")).toBeNull();
  });

  it("flags profiles over the standard limit after Premium lapses and keeps them listed", async () => {
    mockLinked = premiumSummary([item("store"), item("brand"), { ...item("business", "active", true), profileId: "business-3" }], false);
    await renderManageProfiles();
    expect(screen.getByText("3 of 2 business profiles")).toBeTruthy();
    expect(screen.getAllByText("Premium needed for more than 2 business profiles").length).toBeGreaterThan(0);
    expect(screen.getByText("Premium needed")).toBeTruthy();
    expect(screen.getByText("My business")).toBeTruthy();
  });

  it("upsells Blue Premium when a standard account is blocked from another business profile", async () => {
    mockLinked = summary([item("store")]);
    await render(createElement(ProfileLimitGate, { kind: "business" }, createElement(Text, null, "form")));
    expect(screen.getByText("Get Blue Premium for up to 5 business profiles")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Manage profiles" })).toBeTruthy();
  });

  it("explains the one-store rule without an upsell when a second store is blocked", async () => {
    mockLinked = premiumSummary([item("store")]);
    await render(createElement(ProfileLimitGate, { kind: "store" }, createElement(Text, null, "form")));
    expect(screen.getByText("You can own one store")).toBeTruthy();
    expect(screen.queryByText("Get Blue Premium for up to 5 business profiles")).toBeNull();
  });
});

describe("brand selling switch", () => {
  it("confirms, steps up and sends sellingEnabled", async () => {
    const brand = { id: "brand-1", name: "Temi Clay", sellingEnabled: false } as BrandDetail;
    const setBrandSelling = jest.spyOn(brandsService, "setBrandSelling").mockResolvedValue({ ...brand, sellingEnabled: true });
    await render(withQueryClient(createElement(BrandSellingSwitch, { brand })));
    expect(screen.getByText("Selling is off. This brand is a showcase only.")).toBeTruthy();
    fireEvent(screen.getByLabelText("Sell products with this brand"), "valueChange", true);
    expect(setBrandSelling).not.toHaveBeenCalled();
    const buttons = (showAlertWithButtons as jest.Mock).mock.calls[0][2] as { text: string; onPress?: () => void }[];
    await act(async () => buttons.find((button) => button.text === "Turn on")!.onPress!());
    expect(setBrandSelling).toHaveBeenCalledWith("brand-1", true, "step-up-token");
  });
});
