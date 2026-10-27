import NetInfo from "@react-native-community/netinfo";
import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";
import { AppState, Platform } from "react-native";

import { useUploadQueueStore } from "@/store/uploadQueue.store";

import { startDrainingUploadQueue } from "../media/mediaUploadQueue.service";

const RESUME_PENDING_UPLOADS_TASK_NAME = "nantty-resume-pending-media-uploads";
const MINIMUM_BACKGROUND_INTERVAL_MINUTES = 15;
const BACKGROUND_TIME_BUDGET_MS = 25_000;
const isBackgroundTaskSupported = Platform.OS === "ios" || Platform.OS === "android";

const hasResumableUploads = () =>
  Object.values(useUploadQueueStore.getState().jobsById).some((job) =>
    ["queued", "uploading", "waitingForNetwork", "processing"].includes(job.status),
  );

const waitForUploadStoreToLoadFromDisk = () =>
  new Promise<void>((resolve) => {
    if (useUploadQueueStore.persist.hasHydrated()) return resolve();
    const unsubscribe = useUploadQueueStore.persist.onFinishHydration(() => {
      unsubscribe();
      resolve();
    });
  });

if (isBackgroundTaskSupported && !TaskManager.isTaskDefined(RESUME_PENDING_UPLOADS_TASK_NAME)) {
  TaskManager.defineTask(RESUME_PENDING_UPLOADS_TASK_NAME, async () => {
    try {
      await waitForUploadStoreToLoadFromDisk();
      if (!hasResumableUploads()) return BackgroundTask.BackgroundTaskResult.Success;
      await Promise.race([startDrainingUploadQueue(), new Promise((resolve) => setTimeout(resolve, BACKGROUND_TIME_BUDGET_MS))]);
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch {
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

async function registerBackgroundUploadResumeTask() {
  if (!isBackgroundTaskSupported) return;
  const status = await BackgroundTask.getStatusAsync();
  if (status !== BackgroundTask.BackgroundTaskStatus.Available) return;
  if (await TaskManager.isTaskRegisteredAsync(RESUME_PENDING_UPLOADS_TASK_NAME)) return;
  await BackgroundTask.registerTaskAsync(RESUME_PENDING_UPLOADS_TASK_NAME, { minimumInterval: MINIMUM_BACKGROUND_INTERVAL_MINUTES });
}

let hasStartedAutomaticUploadResume = false;

export function startAutomaticUploadResume() {
  if (hasStartedAutomaticUploadResume) return;
  hasStartedAutomaticUploadResume = true;
  waitForUploadStoreToLoadFromDisk()
    .then(() => startDrainingUploadQueue())
    .catch(() => undefined);
  AppState.addEventListener("change", (state) => {
    if (state === "active") startDrainingUploadQueue().catch(() => undefined);
  });
  NetInfo.addEventListener((network) => {
    if (network.isConnected) startDrainingUploadQueue().catch(() => undefined);
  });
  registerBackgroundUploadResumeTask().catch(() => undefined);
}
