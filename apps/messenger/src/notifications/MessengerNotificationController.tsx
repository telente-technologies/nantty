import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import { Alert, AppState } from "react-native";
import { useMessengerAuth } from "../auth/AuthProvider";
import { parseConversationList } from "../api/conversations";
import { drainEncryptedOutbox, fetchEncryptedMessages, markConversationRead, sendEncryptedText } from "../api/messengerChat.service";
import { notificationActionRead, notificationActionReply } from "../api/notificationActions.service";
import { shouldExecuteInteractiveNotificationAction } from "../api/notificationActions.util";
import { getChatBubblePreferences } from "../api/chatBubblePreferences.service";
import { configureMessengerNotificationActions } from "../api/notificationActions.service";
import * as Crypto from "expo-crypto";
import { requestConversationOpen } from "../navigation/notificationNavigation.service";

export function MessengerNotificationController() {
  const { request, status } = useMessengerAuth();
  const handled = useRef(new Set<string>());

  useEffect(() => {
    let active = true;
    if (status !== "signedIn") {
      void configureMessengerNotificationActions(false).catch(() => undefined);
      return () => { active = false; };
    }
    void getChatBubblePreferences()
      .then(({ interactiveNotifications }) => active ? configureMessengerNotificationActions(interactiveNotifications) : undefined)
      .catch(() => undefined);
    return () => { active = false; };
  }, [status]);

  useEffect(() => {
    if (status !== "signedIn") return;
    const process = async (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const actionText = response.userText?.trim() ?? "";
      const responseKey = `${response.notification.request.identifier}\u0000${response.notification.date}\u0000${response.actionIdentifier}\u0000${actionText}`;
      if (handled.current.has(responseKey)) {
        await Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
        return;
      }
      handled.current.add(responseKey);
      if (handled.current.size > 128) {
        const oldest = handled.current.values().next().value;
        if (oldest) handled.current.delete(oldest);
      }
      const data = response.notification.request.content.data ?? {};
      const conversationId = typeof data["conversationId"] === "string" ? data["conversationId"] : "";
      if (!conversationId) {
        await Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
        return;
      }
      if (response.actionIdentifier === notificationActionReply || response.actionIdentifier === notificationActionRead) {
        let interactiveNotifications = false;
        try { interactiveNotifications = (await getChatBubblePreferences()).interactiveNotifications; } catch { /* Fail closed if the local preference cannot be read. */ }
        if (!shouldExecuteInteractiveNotificationAction(response.actionIdentifier, interactiveNotifications)) {
          requestConversationOpen(conversationId);
          await Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
          return;
        }
      }
      if (response.actionIdentifier === notificationActionRead) {
        await markConversationRead(request, conversationId).catch(() => undefined);
        await Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
        return;
      }
      if (response.actionIdentifier === notificationActionReply) {
        const text = actionText;
        if (text) {
          const data = response.notification.request.content.data ?? {};
          const messageId = typeof data["messageId"] === "string" ? data["messageId"] : response.notification.request.identifier;
          const responseDigest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${messageId}\u0000${response.actionIdentifier}\u0000${text}`);
          const replyIdempotencyKey = `notification-${responseDigest}`;
          try {
            const result = await request<unknown>("/api/v1/conversations?filter=all");
            const conversation = parseConversationList(result).find((item) => item.id === conversationId);
            if (!conversation) throw new Error("Conversation is no longer available on this device.");
            await sendEncryptedText(request, conversation, text, replyIdempotencyKey.length >= 8 ? replyIdempotencyKey : Crypto.randomUUID());
            await markConversationRead(request, conversationId).catch(() => undefined);
          } catch {
            requestConversationOpen(conversationId);
            Alert.alert("Reply not sent", "Open this conversation in Messenger to retry securely.");
          }
          await Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
          return;
        }
      }
      requestConversationOpen(conversationId);
      void fetchEncryptedMessages(request, conversationId).catch(() => undefined);
      void Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
    };
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => { void process(response); });
    void Notifications.getLastNotificationResponseAsync().then(process).catch(() => undefined);
    const appStateSubscription = AppState.addEventListener("change", (next) => { if (next === "active") void drainEncryptedOutbox(request); });
    void drainEncryptedOutbox(request);
    return () => { subscription.remove(); appStateSubscription.remove(); };
  }, [request, status]);

  return null;
}
