import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants, { ExecutionEnvironment } from "expo-constants";
import * as TaskManager from "expo-task-manager";
import { AppState, Platform } from "react-native";

import { widgetKinds, widgetStorageKeys, type WidgetKind } from "@/config/widgets.config";
import { api } from "@/services/core/apiClient.service";
import { registerSignOutHook } from "@/store/auth.store";
import { usersService } from "@/services/account/users.service";

type NotificationsModule = typeof import("expo-notifications");
type WidgetSyncModule = typeof import("./widgetSync.service");

export const WIDGET_PUSH_TASK_NAME = "nantty-widget-refresh-push";
const widgetRefreshType = "widgetRefresh";
const tokenStorageKey = widgetStorageKeys.pushToken;

export function isWidgetPushSupported(): boolean {
  return (Platform.OS === "ios" || Platform.OS === "android") && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
}

function loadNotifications(): NotificationsModule | null {
  if (!isWidgetPushSupported()) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const notifications = require("expo-notifications") as NotificationsModule;
    return typeof notifications.getExpoPushTokenAsync === "function" ? notifications : null;
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === "string") {
    try {
      return asRecord(JSON.parse(value));
    } catch {
      return null;
    }
  }
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function readRefreshFromRecord(record: Record<string, unknown> | null): WidgetKind[] | null {
  if (record === null || record["type"] !== widgetRefreshType) return null;
  const requested = Array.isArray(record["widgets"]) ? record["widgets"] : [];
  const kinds = widgetKinds.filter((kind) => requested.includes(kind));
  return kinds.length > 0 ? kinds : [...widgetKinds];
}

export function readWidgetRefreshKinds(payload: unknown): WidgetKind[] | null {
  const root = asRecord(payload);
  if (root === null) return null;
  const data = asRecord(root["data"]);
  const content = asRecord(asRecord(asRecord(asRecord(root["notification"])?.["request"])?.["content"]) ?? asRecord(asRecord(root["request"])?.["content"]));
  const candidates = [root, data, asRecord(data?.["dataString"]), asRecord(data?.["body"]), asRecord(content?.["data"])];
  for (const candidate of candidates) {
    const kinds = readRefreshFromRecord(candidate);
    if (kinds !== null) return kinds;
  }
  return null;
}

async function refreshWidgetsFromPush(kinds: readonly WidgetKind[]): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { syncHomeScreenWidgetsNow } = require("./widgetSync.service") as WidgetSyncModule;
  await syncHomeScreenWidgetsNow({ force: true, kinds });
}

if (isWidgetPushSupported() && !TaskManager.isTaskDefined(WIDGET_PUSH_TASK_NAME)) {
  TaskManager.defineTask(WIDGET_PUSH_TASK_NAME, async ({ data, error }) => {
    if (error) return;
    const kinds = readWidgetRefreshKinds(data);
    if (kinds !== null) await refreshWidgetsFromPush(kinds).catch(() => undefined);
  });
}

function readProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

let hasStartedWidgetRefreshListener = false;

/** Registers only the silent widget-refresh handler; it never asks for permission or registers a device token. */
export async function startWidgetRefreshTask(): Promise<void> {
  const notifications = loadNotifications();
  if (notifications === null) return;
  if (!hasStartedWidgetRefreshListener) {
    hasStartedWidgetRefreshListener = true;
    notifications.addNotificationReceivedListener((notification) => {
      const kinds = readWidgetRefreshKinds(notification.request.content.data);
      if (kinds !== null) refreshWidgetsFromPush(kinds).catch(() => undefined);
    });
    await notifications.registerTaskAsync(WIDGET_PUSH_TASK_NAME).catch(() => undefined);
  }
}

async function registerDeviceForAccountPush(notifications: NotificationsModule): Promise<void> {
  const projectId = readProjectId();
  if (projectId === undefined) throw new Error("Push notifications are not configured on this build.");
  const token = (await notifications.getExpoPushTokenAsync({ projectId })).data;
  const registeredToken = await AsyncStorage.getItem(tokenStorageKey);
  if (registeredToken === token) return;
  if (registeredToken !== null && !(await removeRegisteredDeviceToken(registeredToken))) {
    throw new Error("The previous notification device could not be updated. Try again.");
  }
  await api.post("/api/v1/notifications/device-tokens", { token, platform: Platform.OS });
  await AsyncStorage.setItem(tokenStorageKey, token);
}

async function removeRegisteredDeviceToken(token: string): Promise<boolean> {
  try {
    await api.delete("/api/v1/notifications/device-tokens", { body: { token } });
    await AsyncStorage.removeItem(widgetStorageKeys.pushToken);
    return true;
  } catch {
    // Keep the token locally so a later sign-out or rotation can retry deletion.
    return false;
  }
}

export async function unregisterDeviceFromWidgetPush(): Promise<void> {
  const token = await AsyncStorage.getItem(tokenStorageKey);
  if (token === null) return;
  await removeRegisteredDeviceToken(token);
}

export async function enableAccountPushNotifications(savePreference: (enabled: boolean) => Promise<unknown>): Promise<"granted" | "denied"> {
  const notifications = loadNotifications();
  if (notifications === null) throw new Error("Push notifications are unavailable in this app build.");
  let permission = await notifications.getPermissionsAsync();
  if (!permission.granted) permission = await notifications.requestPermissionsAsync();
  if (!permission.granted) return "denied";
  await savePreference(true);
  try {
    await registerDeviceForAccountPush(notifications);
  } catch (error) {
    await savePreference(false).catch(() => undefined);
    await unregisterDeviceFromWidgetPush();
    throw error;
  }
  return "granted";
}

export async function disableAccountPushNotifications(savePreference: (enabled: boolean) => Promise<unknown>): Promise<void> {
  await savePreference(false);
  await unregisterDeviceFromWidgetPush();
}

/** Revalidates token rotation without prompting; callers must first confirm account-level opt-in. */
export async function syncAccountPushRegistrationIfPermitted(): Promise<void> {
  const notifications = loadNotifications();
  if (notifications === null) return;
  const permission = await notifications.getPermissionsAsync();
  if (!permission.granted) {
    await unregisterDeviceFromWidgetPush();
    return;
  }
  await registerDeviceForAccountPush(notifications);
}

let hasStartedAccountPushLifecycle = false;

export function startAccountPushRegistrationLifecycle(): void {
  if (hasStartedAccountPushLifecycle) return;
  hasStartedAccountPushLifecycle = true;
  AppState.addEventListener("change", (state) => {
    if (state === "active") void syncAccountPushRegistrationForCurrentAccount();
  });
}

export async function syncAccountPushRegistrationForCurrentAccount(): Promise<void> {
  try {
    const settings = await usersService.fetchMyAccountSettings();
    if (settings.pushNotificationsEnabled) await syncAccountPushRegistrationIfPermitted();
    else await unregisterDeviceFromWidgetPush();
  } catch {
    // A settings/network failure must never prompt or register a device.
  }
}

registerSignOutHook(unregisterDeviceFromWidgetPush);
