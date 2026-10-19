import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants, { ExecutionEnvironment } from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { androidWidgetNames, iosWidgetTimelineKinds, widgetAppGroup, widgetKinds, type WidgetKind } from "@/config/widgets.config";
import { type AndroidWidgetModules, loadAndroidWidgetModules } from "@/widgets/android/androidWidgetModules";

type AppleExtensionStorageModule = typeof import("@bacons/apple-targets");

export const widgetKeychainService = "zudomart.widgets";

const widgetSecureStoreOptions: SecureStore.SecureStoreOptions = {
  keychainService: widgetKeychainService,
  accessGroup: widgetAppGroup,
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

export function areHomeScreenWidgetsSupported(): boolean {
  if (Platform.OS !== "ios" && Platform.OS !== "android") return false;
  return Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
}

function loadAppleExtensionStorage(): AppleExtensionStorageModule | null {
  if (Platform.OS !== "ios" || !areHomeScreenWidgetsSupported()) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const module = require("@bacons/apple-targets") as AppleExtensionStorageModule;
    return typeof module.ExtensionStorage === "function" ? module : null;
  } catch {
    return null;
  }
}

function loadAndroidWidgets(): AndroidWidgetModules | null {
  if (Platform.OS !== "android" || !areHomeScreenWidgetsSupported()) return null;
  return loadAndroidWidgetModules();
}

export async function writeWidgetSharedValue(key: string, value: string | null): Promise<void> {
  if (!areHomeScreenWidgetsSupported()) return;
  const apple = loadAppleExtensionStorage();
  if (apple !== null) {
    const storage = new apple.ExtensionStorage(widgetAppGroup);
    if (value === null) storage.remove(key);
    else storage.set(key, value);
    return;
  }
  if (Platform.OS === "android") {
    if (value === null) await AsyncStorage.removeItem(key);
    else await AsyncStorage.setItem(key, value);
  }
}

export async function readWidgetSharedValue(key: string): Promise<string | null> {
  if (!areHomeScreenWidgetsSupported()) return null;
  const apple = loadAppleExtensionStorage();
  if (apple !== null) return new apple.ExtensionStorage(widgetAppGroup).get(key);
  return Platform.OS === "android" ? AsyncStorage.getItem(key) : null;
}

export async function writeWidgetSecret(key: string, value: string | null): Promise<void> {
  if (!areHomeScreenWidgetsSupported()) return;
  if (value === null) await SecureStore.deleteItemAsync(key, widgetSecureStoreOptions);
  else await SecureStore.setItemAsync(key, value, widgetSecureStoreOptions);
}

export async function readWidgetSecret(key: string): Promise<string | null> {
  if (!areHomeScreenWidgetsSupported()) return null;
  return SecureStore.getItemAsync(key, widgetSecureStoreOptions);
}

export async function reloadHomeScreenWidgets(kinds: readonly WidgetKind[] = widgetKinds): Promise<void> {
  const apple = loadAppleExtensionStorage();
  if (apple !== null) {
    for (const kind of kinds) apple.ExtensionStorage.reloadWidget(iosWidgetTimelineKinds[kind]);
    return;
  }
  const android = loadAndroidWidgets();
  if (android === null) return;
  await Promise.all(kinds.map((kind) => android.widgets.requestWidgetUpdate({
    widgetName: androidWidgetNames[kind],
    renderWidget: (info) => android.renderer.renderStoredAndroidWidget(kind, info),
  }).catch(() => undefined)));
}
