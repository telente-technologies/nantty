import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants, { ExecutionEnvironment } from "expo-constants";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";

import { widgetKinds, widgetStorageKeys, type WidgetKind } from "@/config/widgets.config";
import { api } from "@/services/apiClient.service";

type NotificationsModule = typeof import("expo-notifications");
type WidgetSyncModule = typeof import("./widgetSync.service");

export const WIDGET_PUSH_TASK_NAME = "zudomart-widget-refresh-push";
const widgetRefreshType = "widgetRefresh";

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

let hasStartedWidgetPush = false;

export async function startWidgetRefreshPush(): Promise<void> {
  const notifications = loadNotifications();
  if (notifications === null) return;
  if (!hasStartedWidgetPush) {
    hasStartedWidgetPush = true;
    notifications.addNotificationReceivedListener((notification) => {
      const kinds = readWidgetRefreshKinds(notification.request.content.data);
      if (kinds !== null) refreshWidgetsFromPush(kinds).catch(() => undefined);
    });
    await notifications.registerTaskAsync(WIDGET_PUSH_TASK_NAME).catch(() => undefined);
  }
  await registerDeviceForWidgetPush(notifications);
}

async function registerDeviceForWidgetPush(notifications: NotificationsModule): Promise<void> {
  const projectId = readProjectId();
  if (projectId === undefined) return;
  const token = await notifications.getExpoPushTokenAsync({ projectId }).then((result) => result.data, () => null);
  if (token === null) return;
  if ((await AsyncStorage.getItem(widgetStorageKeys.pushToken)) === token) return;
  await api.post("/api/v1/notifications/device-tokens", { token, platform: Platform.OS });
  await AsyncStorage.setItem(widgetStorageKeys.pushToken, token);
}

export async function unregisterDeviceFromWidgetPush(): Promise<void> {
  if (!isWidgetPushSupported()) return;
  const token = await AsyncStorage.getItem(widgetStorageKeys.pushToken);
  if (token === null) return;
  await api.delete("/api/v1/notifications/device-tokens", { body: { token } }).catch(() => undefined);
  await AsyncStorage.removeItem(widgetStorageKeys.pushToken);
}
