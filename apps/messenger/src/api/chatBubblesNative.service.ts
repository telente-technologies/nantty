import { NativeModules, Platform } from "react-native";

export type AndroidBubbleStatus = "ready" | "unsupported" | "notification_permission_required" | "system_bubbles_disabled" | "unavailable";

export interface AndroidBubbleCapabilities {
  readonly systemBubblesSupported: boolean;
  readonly notificationsEnabled: boolean;
  readonly systemBubblesEnabled: boolean;
  readonly systemBubblePreference?: number;
  readonly status: AndroidBubbleStatus;
}

export interface AndroidConversationChannelStatus {
  readonly status: "unsupported" | "invalid_identity" | "channel_not_created" | "available" | string;
  readonly channelExists: boolean;
  readonly canBubble: boolean | null;
  readonly importance: number | null;
}

interface NativeChatBubblesModule {
  getCapabilities(): Promise<AndroidBubbleCapabilities>;
  openBubbleSettings(): Promise<{ readonly opened: boolean; readonly status: string }>;
  openConversationNotificationSettings(accountId: string, conversationId: string): Promise<{ readonly opened: boolean; readonly status: string }>;
  getConversationNotificationChannelStatus(accountId: string, conversationId: string): Promise<AndroidConversationChannelStatus>;
  sendTestBubble(): Promise<{ readonly notificationPosted?: boolean; readonly bubbleEligible?: boolean; readonly status: string }>;
  clearAccountBubbleState(): Promise<boolean>;
}

export async function getAndroidConversationChannelStatus(accountId: string, conversationId: string): Promise<AndroidConversationChannelStatus> {
  if (Platform.OS !== "android" || !nativeModule) return { status: "unsupported", channelExists: false, canBubble: null, importance: null };
  try { return await nativeModule.getConversationNotificationChannelStatus(accountId, conversationId); }
  catch { return { status: "unavailable", channelExists: false, canBubble: null, importance: null }; }
}

const nativeModule = NativeModules.NanttyChatBubbles as NativeChatBubblesModule | undefined;

export async function getAndroidBubbleCapabilities(): Promise<AndroidBubbleCapabilities> {
  if (Platform.OS !== "android" || !nativeModule) {
    return { systemBubblesSupported: false, notificationsEnabled: false, systemBubblesEnabled: false, status: "unavailable" };
  }
  try { return await nativeModule.getCapabilities(); }
  catch { return { systemBubblesSupported: false, notificationsEnabled: false, systemBubblesEnabled: false, status: "unavailable" }; }
}

export async function openAndroidBubbleSettings(): Promise<boolean> {
  if (Platform.OS !== "android" || !nativeModule) return false;
  try { return (await nativeModule.openBubbleSettings()).opened; }
  catch { return false; }
}

export async function openAndroidConversationNotificationSettings(accountId: string, conversationId: string): Promise<string> {
  if (Platform.OS !== "android" || !nativeModule) return "unsupported";
  try { return (await nativeModule.openConversationNotificationSettings(accountId, conversationId)).status; }
  catch { return "unavailable"; }
}

export async function sendAndroidBubbleTest(): Promise<{ readonly notificationPosted?: boolean; readonly bubbleEligible?: boolean; readonly status: string }> {
  if (Platform.OS !== "android" || !nativeModule) return { status: "unavailable" };
  return nativeModule.sendTestBubble();
}

export async function clearAccountBubbleState(): Promise<void> {
  if (Platform.OS !== "android" || !nativeModule) return;
  await nativeModule.clearAccountBubbleState();
}
