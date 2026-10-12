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

const item = (kind: "store" | "business" | "brand", status: "active" | "held" = "active") => ({ kind, profileId: `${kind}-${status}`, storeId: kind === "store" ? "store-1" : null, status, holdReason: null, name: `My ${kind}`, handle: kind, showsMart: kind === "store" });
const summary = (items: LinkedProfiles["items"]): LinkedProfiles => {
  const active = items.filter((entry) => entry.status === "active");
  const slot = active.some((entry) => entry.kind !== "brand");
  return { accountId: "me", items, canCreate: { store: !slot, business: !slot, brand: !active.some((entry) => entry.kind === "brand") }, choiceRequired: items.some((entry) => entry.status === "held") };
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
