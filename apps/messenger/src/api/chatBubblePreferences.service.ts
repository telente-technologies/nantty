import * as SecureStore from "expo-secure-store";
import { bubblePositionStorageKeys } from "./chatBubblePreferences.util";
export { isConversationBubbleEnabled, toggleConversationBubble } from "./chatBubblePreferences.util";

const preferencesKey = "nantty.messenger.chatBubbles.v1";
const legacyPositionIndexKey = "nantty.messenger.bubblePositions.index";
let positionIndexWrite: Promise<void> = Promise.resolve();

export interface ChatBubblePreferences {
  readonly enabled: boolean;
  readonly inAppEnabled: boolean;
  readonly inAppConversationIds: readonly string[];
  readonly mode: "all" | "selected";
  readonly conversationIds: readonly string[];
  readonly excludedConversationIds: readonly string[];
  readonly showUnreadCount: boolean;
  readonly showMessagePreview: boolean;
  readonly interactiveNotifications: boolean;
  readonly sound: boolean;
  readonly vibration: boolean;
  readonly systemSetupCompleted: boolean;
  readonly notificationPermissionPrompted: boolean;
}

export const defaultChatBubblePreferences: ChatBubblePreferences = {
  enabled: false,
  inAppEnabled: false,
  inAppConversationIds: [],
  mode: "selected",
  conversationIds: [],
  excludedConversationIds: [],
  showUnreadCount: true,
  showMessagePreview: true,
  interactiveNotifications: true,
  sound: true,
  vibration: true,
  systemSetupCompleted: false,
  notificationPermissionPrompted: false,
};

export async function getChatBubblePreferences(): Promise<ChatBubblePreferences> {
  const value = await SecureStore.getItemAsync(preferencesKey);
  if (!value) return defaultChatBubblePreferences;
  try {
    const saved = JSON.parse(value) as Partial<ChatBubblePreferences>;
    return {
      ...defaultChatBubblePreferences,
      ...saved,
      systemSetupCompleted: saved.systemSetupCompleted === true,
      notificationPermissionPrompted: saved.notificationPermissionPrompted === true,
      inAppEnabled: typeof saved.inAppEnabled === "boolean" ? saved.inAppEnabled : saved.enabled === true,
      inAppConversationIds: Array.isArray(saved.inAppConversationIds) ? saved.inAppConversationIds.filter((id): id is string => typeof id === "string") : [],
      mode: saved.mode === "all" ? "all" : "selected",
      conversationIds: Array.isArray(saved.conversationIds) ? saved.conversationIds.filter((id): id is string => typeof id === "string") : [],
      excludedConversationIds: Array.isArray(saved.excludedConversationIds) ? saved.excludedConversationIds.filter((id): id is string => typeof id === "string") : [],
    };
  } catch {
    return defaultChatBubblePreferences;
  }
}

export async function saveChatBubblePreferences(update: Partial<ChatBubblePreferences>): Promise<ChatBubblePreferences> {
  const current = await getChatBubblePreferences();
  const next = { ...current, ...update };
  await SecureStore.setItemAsync(preferencesKey, JSON.stringify(next));
  return next;
}

export async function clearChatBubblePreferences(accountId?: string | null): Promise<void> {
  await positionIndexWrite;
  const indexKeys = [legacyPositionIndexKey, ...(accountId ? [bubblePositionStorageKeys(accountId, "").index] : [])];
  const indexes = await Promise.all(indexKeys.map((key) => SecureStore.getItemAsync(key).catch(() => null)));
  const positionIds = new Set<string>();
  for (const value of indexes) {
    try {
      const parsed: unknown = value ? JSON.parse(value) : [];
      if (Array.isArray(parsed)) parsed.filter((id): id is string => typeof id === "string").forEach((id) => positionIds.add(id));
    } catch { /* Invalid indexes are removed with the preference records. */ }
  }
  const positionKeys = [...positionIds].flatMap((id) => [legacyPositionKey(id), ...(accountId ? [positionKey(accountId, id)] : [])]);
  await Promise.all([preferencesKey, ...indexKeys, ...positionKeys].map((key) => SecureStore.deleteItemAsync(key).catch(() => undefined)));
}

const positionKey = (accountId: string, conversationId: string) => bubblePositionStorageKeys(accountId, conversationId).position;
const positionIndexKey = (accountId: string) => bubblePositionStorageKeys(accountId, "").index;
const legacyPositionKey = (conversationId: string) => `nantty.messenger.bubblePosition.${conversationId.replace(/[^A-Za-z0-9._-]/g, "_")}`;

export async function getBubblePosition(accountId: string, conversationId: string): Promise<{ readonly x: number; readonly y: number } | null> {
  if (!accountId) return null;
  const value = await SecureStore.getItemAsync(positionKey(accountId, conversationId));
  if (!value) return null;
  try {
    const point = JSON.parse(value) as { x?: unknown; y?: unknown };
    return typeof point.x === "number" && Number.isFinite(point.x) && typeof point.y === "number" && Number.isFinite(point.y) ? { x: point.x, y: point.y } : null;
  } catch { return null; }
}

export async function saveBubblePosition(accountId: string, conversationId: string, point: { readonly x: number; readonly y: number }): Promise<void> {
  if (!accountId) return;
  await SecureStore.setItemAsync(positionKey(accountId, conversationId), JSON.stringify(point));
  const indexKey = positionIndexKey(accountId);
  const write = positionIndexWrite.then(async () => {
    const saved = await SecureStore.getItemAsync(indexKey);
    let ids: string[] = [];
    try { ids = saved ? JSON.parse(saved) as string[] : []; } catch { ids = []; }
    if (!ids.includes(conversationId)) await SecureStore.setItemAsync(indexKey, JSON.stringify([...ids, conversationId]));
  });
  positionIndexWrite = write.catch(() => undefined);
  await write;
}

