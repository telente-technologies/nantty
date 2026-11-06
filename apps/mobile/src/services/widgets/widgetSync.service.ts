import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";
import { AppState } from "react-native";

import type { WidgetKind } from "@/config/widgets.config";

import { registerSignOutHook, useAuthStore } from "@/store/auth.store";
import { useWidgetPreferencesStore } from "@/store/widgetPreferences.store";

import { areHomeScreenWidgetsSupported, reloadHomeScreenWidgets } from "./widgetNativeBridge.service";
import { clearWidgetSnapshotsForSignOut, refreshWidgetSnapshots } from "./widgetSnapshots.service";
import { startWidgetRefreshTask } from "./widgetPush.service";
import { forgetWidgetTokenOnThisDevice, rotateWidgetTokenWhenDue } from "./widgetToken.service";

export const WIDGET_REFRESH_TASK_NAME = "nantty-refresh-home-screen-widgets";
const WIDGET_REFRESH_INTERVAL_MINUTES = 30;
const FOREGROUND_SYNC_COOLDOWN_MS = 2 * 60 * 1000;

let lastSyncStartedAt = 0;
let runningSync: Promise<void> | null = null;

async function ensureSessionRestored(): Promise<boolean> {
  if (useAuthStore.getState().status === "loading") await useAuthStore.getState().restoreSavedSession().catch(() => undefined);
  return useAuthStore.getState().status === "signedIn";
}

export function syncHomeScreenWidgetsNow(options: { readonly force?: boolean; readonly kinds?: readonly WidgetKind[] } = {}): Promise<void> {
  if (!areHomeScreenWidgetsSupported()) return Promise.resolve();
  const now = Date.now();
  if (runningSync !== null) return runningSync;
  if (options.force !== true && now - lastSyncStartedAt < FOREGROUND_SYNC_COOLDOWN_MS) return Promise.resolve();
  lastSyncStartedAt = now;
  runningSync = (async () => {
    if (!(await ensureSessionRestored())) return;
    await startWidgetRefreshTask().catch(() => undefined);
    await rotateWidgetTokenWhenDue().catch(() => false);
    const written = await refreshWidgetSnapshots(useWidgetPreferencesStore.getState().hideAmounts, options.kinds);
    await reloadHomeScreenWidgets(written);
  })().finally(() => {
    runningSync = null;
  });
  return runningSync;
}

export async function clearHomeScreenWidgetsForSignOut(): Promise<void> {
  if (!areHomeScreenWidgetsSupported()) return;
  await forgetWidgetTokenOnThisDevice(true);
  await clearWidgetSnapshotsForSignOut();
  await reloadHomeScreenWidgets();
}

if (areHomeScreenWidgetsSupported() && !TaskManager.isTaskDefined(WIDGET_REFRESH_TASK_NAME)) {
  TaskManager.defineTask(WIDGET_REFRESH_TASK_NAME, async () => {
    try {
      await syncHomeScreenWidgetsNow({ force: true });
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch {
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

async function registerWidgetRefreshBackgroundTask(): Promise<void> {
  if ((await BackgroundTask.getStatusAsync()) !== BackgroundTask.BackgroundTaskStatus.Available) return;
  if (await TaskManager.isTaskRegisteredAsync(WIDGET_REFRESH_TASK_NAME)) return;
  await BackgroundTask.registerTaskAsync(WIDGET_REFRESH_TASK_NAME, { minimumInterval: WIDGET_REFRESH_INTERVAL_MINUTES });
}

let hasStartedWidgetSync = false;

export function startHomeScreenWidgetSync(): void {
  if (hasStartedWidgetSync || !areHomeScreenWidgetsSupported()) return;
  hasStartedWidgetSync = true;
  registerSignOutHook(clearHomeScreenWidgetsForSignOut);
  AppState.addEventListener("change", (state) => {
    if (state === "active") syncHomeScreenWidgetsNow().catch(() => undefined);
  });
  useWidgetPreferencesStore.subscribe((state, previous) => {
    if (state.hideAmounts !== previous.hideAmounts) syncHomeScreenWidgetsNow({ force: true }).catch(() => undefined);
  });
  registerWidgetRefreshBackgroundTask().catch(() => undefined);
  syncHomeScreenWidgetsNow({ force: true }).catch(() => undefined);
}
