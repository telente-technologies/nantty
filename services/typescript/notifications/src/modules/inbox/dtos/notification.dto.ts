import type { StoredNotification } from "../../../interfaces/repositories.interface.js";

const linkDataKeys = ["ticketId", "screen", "caseId", "orderId", "disputeId", "postId", "liveId", "conversationId", "inviteId"] as const;

export type NotificationLinkData = Partial<Record<(typeof linkDataKeys)[number], string>>;

export interface NotificationResponse {
  readonly id: string;
  readonly category: string;
  readonly kind?: string;
  readonly title: string;
  readonly body: string;
  readonly createdAt: string;
  readonly read: boolean;
  readonly actor: StoredNotification["actor"];
  readonly url: string | null;
  readonly data?: NotificationLinkData;
}

export function toInAppPath(value: unknown, webBaseUrl?: string): string | null {
  if (typeof value !== "string" || value === "") return null;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  if (webBaseUrl === undefined) return null;
  try {
    const parsed = new URL(value);
    return parsed.origin === new URL(webBaseUrl).origin ? `${parsed.pathname}${parsed.search}${parsed.hash}` : null;
  } catch {
    return null;
  }
}

function pickLinkData(data: Readonly<Record<string, unknown>>): NotificationLinkData | undefined {
  const picked: Record<string, string> = {};
  for (const key of linkDataKeys) {
    const value = data[key];
    if (typeof value === "string" && value !== "" && value.length <= 200) picked[key] = value;
  }
  return Object.keys(picked).length === 0 ? undefined : picked;
}

export function convertNotificationToResponse(notification: StoredNotification, webBaseUrl?: string): NotificationResponse {
  const data = pickLinkData(notification.data);
  return {
    id: notification.id,
    category: notification.category,
    ...(notification.kind === null ? {} : { kind: notification.kind }),
    title: notification.title,
    body: notification.body,
    createdAt: notification.createdAt.toISOString(),
    read: notification.readAt !== null,
    actor: notification.actor,
    url: toInAppPath(notification.data["url"], webBaseUrl),
    ...(data === undefined ? {} : { data }),
  };
}
