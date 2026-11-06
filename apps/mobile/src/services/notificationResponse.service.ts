import type { NotificationResponse } from "expo-notifications";

import { navigationStateFromNotification } from "@/navigation/notificationRoute.util";

type NotificationsModule = typeof import("expo-notifications");

function loadNotifications(): NotificationsModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("expo-notifications") as NotificationsModule;
  } catch {
    return null;
  }
}

export function subscribeToNotificationResponses(onRoute: (state: NonNullable<ReturnType<typeof navigationStateFromNotification>>) => void): () => void {
  const notifications = loadNotifications();
  if (notifications === null) return () => undefined;

  let active = true;
  const handledResponses = new Set<string>();
  const deliver = (response: NotificationResponse | null, isLastResponse = false) => {
    if (!active || response === null) return;
    const request = response.notification.request;
    const responseKey = `${request.identifier}:${response.actionIdentifier}`;
    if (handledResponses.has(responseKey)) return;
    handledResponses.add(responseKey);
    if (handledResponses.size > 20) handledResponses.delete(handledResponses.values().next().value as string);
    const state = navigationStateFromNotification(request.content.data);
    if (state !== null) onRoute(state);
    else if (isLastResponse) void notifications.clearLastNotificationResponseAsync().catch(() => undefined);
  };

  const subscription = notifications.addNotificationResponseReceivedListener(deliver);
  void notifications.getLastNotificationResponseAsync().then((response) => {
    deliver(response, true);
  }).catch(() => undefined);

  return () => {
    active = false;
    subscription.remove();
  };
}

/** Acknowledge only after navigation consumed the route, so auth-gated cold starts survive process restarts. */
export async function clearHandledNotificationResponse(): Promise<void> {
  await loadNotifications()?.clearLastNotificationResponseAsync().catch(() => undefined);
}
