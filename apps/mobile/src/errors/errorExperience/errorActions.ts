import Constants from "expo-constants";
import { Linking, Platform } from "react-native";

import { rootNavigationRef } from "@/navigation/navigationRef";
import { usePendingAuthIntentStore } from "@/store/pendingAuthIntent.store";

import { defaultActionLabels, type ErrorActionIntent } from "./errorKinds";

export interface ErrorAction {
  readonly label: string;
  readonly onPress: () => void;
  readonly disabled?: boolean;
}

export type ErrorActionHandlers = Partial<Record<ErrorActionIntent, () => void>>;

export interface ActionSources {
  readonly onRetry?: () => void;
  readonly retryLabel?: string;
  readonly handlers?: ErrorActionHandlers;
}

const androidPackage = "com.zudomart.app";

export function readAppStoreUrl(): string {
  if (Platform.OS === "android") return `market://details?id=${androidPackage}`;
  const configured = (Constants.expoConfig?.ios as { appStoreUrl?: string } | undefined)?.appStoreUrl;
  return configured ?? "https://apps.apple.com/search?term=nantty";
}

export function openAppStoreListing(): void {
  Linking.openURL(readAppStoreUrl()).catch(() => Linking.openURL(`https://play.google.com/store/apps/details?id=${androidPackage}`).catch(() => undefined));
}

function navigateTo(name: string, params?: object): void {
  if (!rootNavigationRef.isReady()) return;
  (rootNavigationRef.navigate as (route: string, routeParams?: object) => void)(name, params);
}

export function goHome(): void {
  navigateTo("Tabs", { screen: "Home" });
}

function goBack(): void {
  if (rootNavigationRef.isReady() && rootNavigationRef.canGoBack()) rootNavigationRef.goBack();
  else goHome();
}

const defaultHandlers: Partial<Record<ErrorActionIntent, () => void>> = {
  home: goHome,
  browse: goHome,
  back: goBack,
  search: () => navigateTo("Search"),
  signIn: () => usePendingAuthIntentStore.getState().openSignInPrompt("continue"),
  verify: () => navigateTo("IdentityVerification"),
  openSettings: () => void Linking.openSettings().catch(() => undefined),
  accountStatus: () => navigateTo("AccountStatus"),
  appeal: () => navigateTo("AccountStatus"),
  support: () => navigateTo("SettingsSupport"),
  update: openAppStoreListing,
  useApp: openAppStoreListing,
  chooseCountry: () => navigateTo("SettingsAppPreference"),
  viewCart: () => navigateTo("Cart"),
  viewOrders: () => navigateTo("Orders"),
  changeAddress: () => navigateTo("ShippingAddresses"),
  clearDebt: () => navigateTo("Wallet"),
  manageProfiles: () => navigateTo("ManageProfiles"),
  upgrade: () => navigateTo("SellerDashboard"),
};

export function resolveErrorAction(intent: ErrorActionIntent | undefined, sources: ActionSources): ErrorAction | null {
  if (!intent) return null;
  const label = (intent === "retry" ? sources.retryLabel : undefined) ?? defaultActionLabels[intent];
  const custom = sources.handlers?.[intent];
  if (custom) return { label, onPress: custom };
  if (intent === "retry" || intent === "checkAgain" || intent === "reload") return sources.onRetry ? { label: intent === "reload" ? "Reload" : label, onPress: sources.onRetry } : null;
  const fallback = defaultHandlers[intent];
  return fallback ? { label, onPress: fallback } : null;
}
