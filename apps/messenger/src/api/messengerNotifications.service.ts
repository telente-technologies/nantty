import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import type { MessengerRequest } from "./messengerChat.service";
import { configureMessengerNotificationActions } from "./notificationActions.service";

const tokenKey = "nantty.messenger.pushToken.v1";

export async function enableMessengerPush(request: MessengerRequest): Promise<void> {
  const current = await Notifications.getPermissionsAsync();
  const permission = current.granted ? current : await Notifications.requestPermissionsAsync();
  if (!permission.granted) throw new Error("Allow notifications in your device settings to receive Nantty messages.");
  if (Platform.OS === "android") {
    const channels = [
      { id: "nantty-chat-sound-vibrate", name: "Messages", sound: "default" as const, vibrationPattern: [0, 180, 80, 180] },
      { id: "nantty-chat-sound-still", name: "Messages · sound", sound: "default" as const, vibrationPattern: [] },
      { id: "nantty-chat-silent-vibrate", name: "Messages · vibration", sound: null, vibrationPattern: [0, 180, 80, 180] },
      { id: "nantty-chat-silent-still", name: "Messages · silent", sound: null, vibrationPattern: [] },
    ];
    await Promise.all(channels.map(({ id, name, sound, vibrationPattern }) => Notifications.setNotificationChannelAsync(id, {
      name,
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern,
      sound,
      showBadge: true,
    })));
  }
  const previousToken = await SecureStore.getItemAsync(tokenKey);
  const token = Platform.OS === "android"
    ? (await Notifications.getDevicePushTokenAsync()).data
    : (await Notifications.getExpoPushTokenAsync(projectIdOptions())).data;
  const provider = Platform.OS === "android" ? "fcm" : "expo";
  await request<void>("/api/v1/notifications/device-tokens", { method: "POST", body: { token, platform: Platform.OS, provider } });
  if (previousToken && previousToken !== token) {
    await request<void>("/api/v1/notifications/device-tokens", { method: "DELETE", body: { token: previousToken } }).catch(() => undefined);
  }
  await SecureStore.setItemAsync(tokenKey, token);
}

function projectIdOptions(): { readonly projectId?: string } {
  const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
  return projectId ? { projectId } : {};
}

export async function migrateAndroidMessengerPushToken(request: MessengerRequest): Promise<void> {
  if (Platform.OS !== "android") return;
  const currentToken = await SecureStore.getItemAsync(tokenKey);
  const permission = await Notifications.getPermissionsAsync();
  if (currentToken && permission.granted && /^(ExponentPushToken|ExpoPushToken)\[/.test(currentToken)) {
    await enableMessengerPush(request);
  }
}

export async function disableMessengerPush(request?: MessengerRequest): Promise<void> {
  const token = await SecureStore.getItemAsync(tokenKey);
  if (token && request) await request<void>("/api/v1/notifications/device-tokens", { method: "DELETE", body: { token } }).catch(() => undefined);
  await SecureStore.deleteItemAsync(tokenKey).catch(() => undefined);
  await configureMessengerNotificationActions(false);
}

export async function getMessengerPushEnabled(): Promise<boolean> {
  const [token, permission] = await Promise.all([SecureStore.getItemAsync(tokenKey), Notifications.getPermissionsAsync()]);
  return token !== null && permission.granted;
}
