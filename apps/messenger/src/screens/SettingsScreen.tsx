import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, AppState, FlatList, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { Bell, ChatCircleDots, SignOut, ShieldCheck } from "phosphor-react-native";

import { useMessengerAuth } from "../auth/AuthProvider";
import { useMessengerColors } from "../ui/useMessengerColors";
import { ScreenFrame } from "../ui/ScreenFrame";
import { defaultChatBubblePreferences, getChatBubblePreferences, saveChatBubblePreferences, type ChatBubblePreferences } from "../api/chatBubblePreferences.service";
import { disableMessengerPush, enableMessengerPush, getMessengerPushEnabled, migrateAndroidMessengerPushToken } from "../api/messengerNotifications.service";
import { configureMessengerNotificationActions } from "../api/notificationActions.service";
import { getAndroidBubbleCapabilities, openAndroidBubbleSettings, sendAndroidBubbleTest, type AndroidBubbleCapabilities } from "../api/chatBubblesNative.service";
import { conversationDisplayName, parseConversationList, type ConversationSummary } from "../api/conversations";
import * as Notifications from "expo-notifications";
import { SafeAreaView } from "react-native-safe-area-context";

interface ChatSettingsResponse {
  readonly notifications: { readonly messages: boolean; readonly groups: boolean; readonly showMessagePreview: boolean; readonly sound: boolean; readonly vibration: boolean; readonly bubbles: boolean; readonly bubbleMode: "all" | "selected"; readonly bubbleConversationIds: readonly string[]; readonly bubbleExcludedConversationIds: readonly string[] };
}

export function SettingsScreen() {
  const colors = useMessengerColors();
  const { user, request, signOut } = useMessengerAuth();
  const [bubbleSettings, setBubbleSettings] = useState<ChatBubblePreferences>(defaultChatBubblePreferences);
  const [chatSettings, setChatSettings] = useState<ChatSettingsResponse["notifications"]>({ messages: true, groups: true, showMessagePreview: true, sound: true, vibration: true, bubbles: false, bubbleMode: "selected", bubbleConversationIds: [], bubbleExcludedConversationIds: [] });
  const [pushEnabled, setPushEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [androidBubbleCapabilities, setAndroidBubbleCapabilities] = useState<AndroidBubbleCapabilities | null>(null);
  const [bubbleTestMessage, setBubbleTestMessage] = useState<string | null>(null);
  const [setupVisible, setSetupVisible] = useState(false);
  const [setupStep, setSetupStep] = useState(0);
  const [setupMessage, setSetupMessage] = useState<string | null>(null);
  const [setupSeen, setSetupSeen] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [availableConversations, setAvailableConversations] = useState<readonly ConversationSummary[]>([]);
  const [selectedIds, setSelectedIds] = useState<readonly string[]>([]);

  useEffect(() => {
    void Promise.all([
      getChatBubblePreferences(),
      request<ChatSettingsResponse>("/api/v1/chat/settings"),
      getMessengerPushEnabled(),
    ]).then(async ([bubbles, chat, push]) => {
      if (push) await migrateAndroidMessengerPushToken(request);
      setBubbleSettings(bubbles);
      setChatSettings(chat.notifications);
      setBubbleSettings((current) => ({ ...current, enabled: chat.notifications.bubbles, mode: chat.notifications.bubbleMode, conversationIds: chat.notifications.bubbleConversationIds, excludedConversationIds: chat.notifications.bubbleExcludedConversationIds }));
      setPushEnabled(push);
      setSetupSeen(bubbles.systemSetupCompleted === true);
    }).catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load notification preferences."));
  }, [request]);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const refresh = () => { void getAndroidBubbleCapabilities().then(setAndroidBubbleCapabilities); };
    refresh();
    const subscription = AppState.addEventListener("change", (state) => { if (state === "active") refresh(); });
    return () => subscription.remove();
  }, []);

  const saveBubbles = async (update: Partial<ChatBubblePreferences>): Promise<boolean> => {
    setBusyKey("bubbles"); setError(null);
    try {
      const current = bubbleSettings;
      const next = { ...current, ...update };
      const response = await request<ChatSettingsResponse>("/api/v1/chat/settings", { method: "PATCH", body: { notifications: {
        bubbles: next.enabled,
        bubbleMode: next.mode,
        bubbleConversationIds: next.conversationIds,
        bubbleExcludedConversationIds: next.excludedConversationIds,
      } } });
      await saveChatBubblePreferences({ ...next, enabled: response.notifications.bubbles, mode: response.notifications.bubbleMode, conversationIds: response.notifications.bubbleConversationIds, excludedConversationIds: response.notifications.bubbleExcludedConversationIds });
      setChatSettings(response.notifications);
      setBubbleSettings({ ...next, enabled: response.notifications.bubbles, mode: response.notifications.bubbleMode, conversationIds: response.notifications.bubbleConversationIds, excludedConversationIds: response.notifications.bubbleExcludedConversationIds });
      return true;
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save bubble preferences."); return false; }
    finally { setBusyKey(null); }
  };

  const requestSystemBubbleEnable = (enabled: boolean) => {
    if (!enabled) { void saveBubbles({ enabled: false }); return; }
    if (Platform.OS === "android" && !setupSeen) { setSetupStep(0); setSetupVisible(true); return; }
    void saveBubbles({ enabled: true });
  };

  const completeSetup = async () => {
    setBusyKey("setup");
    setSetupMessage(null);
    try {
      const initialCapabilities = await getAndroidBubbleCapabilities();
      setAndroidBubbleCapabilities(initialCapabilities);
      if (!initialCapabilities.systemBubblesSupported) { setSetupStep(initialCapabilities.status === "unsupported" ? 4 : 6); return; }
      const permission = await Notifications.getPermissionsAsync();
      if (!permission.granted) {
        if (!permission.canAskAgain || bubbleSettings.notificationPermissionPrompted) {
          setSetupVisible(false);
          await Linking.openSettings();
          return;
        }
        const requested = await Notifications.requestPermissionsAsync();
        const updatedPreferences = await saveChatBubblePreferences({ notificationPermissionPrompted: true });
        setBubbleSettings((current) => ({ ...current, notificationPermissionPrompted: updatedPreferences.notificationPermissionPrompted }));
        if (!requested.granted) { setSetupMessage("Notifications are still disabled. You can enable them in system settings when you are ready."); setSetupStep(1); return; }
      }
      if (!pushEnabled) {
        await enableMessengerPush(request);
        await configureMessengerNotificationActions(bubbleSettings.interactiveNotifications);
        setPushEnabled(true);
      }
      const capabilities = await getAndroidBubbleCapabilities();
      setAndroidBubbleCapabilities(capabilities);
      if (!capabilities.systemBubblesEnabled) {
        setSetupStep(2);
        await openAndroidBubbleSettings();
        return;
      }
      if (!chatSettings.messages && !chatSettings.groups) { setSetupStep(5); return; }
      await saveBubbles({ enabled: true, systemSetupCompleted: true });
      setSetupSeen(true);
      setSetupVisible(false);
    } catch (cause) {
      setSetupMessage(cause instanceof Error ? cause.message : "Could not finish chat bubble setup.");
    } finally { setBusyKey(null); }
  };

  const openConversationPicker = async () => {
    setPickerVisible(true); setPickerLoading(true); setPickerError(null); setPickerSearch("");
    try {
      setAvailableConversations(parseConversationList(await request<unknown>("/api/v1/conversations?filter=all")));
      setSelectedIds(bubbleSettings.mode === "all" ? bubbleSettings.excludedConversationIds : bubbleSettings.conversationIds);
    } catch (cause) { setPickerError(cause instanceof Error ? cause.message : "Could not load conversations."); }
    finally { setPickerLoading(false); }
  };

  const togglePickedConversation = (id: string) => setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  const filteredPickerConversations = useMemo(() => {
    const q = pickerSearch.trim().toLocaleLowerCase();
    return q ? availableConversations.filter((item) => `${conversationDisplayName(item)} ${item.peer.username}`.toLocaleLowerCase().includes(q)) : availableConversations;
  }, [availableConversations, pickerSearch]);

  const sendLocalNotificationTest = async () => {
    try {
      const permission = await Notifications.getPermissionsAsync();
      const granted = permission.granted || (await Notifications.requestPermissionsAsync()).granted;
      if (!granted) { setBubbleTestMessage("Notifications are not permitted. Enable them in device settings to receive alerts."); return; }
      await Notifications.scheduleNotificationAsync({ content: { title: "Nantty notification test", body: "Notifications are enabled on this device.", data: { type: "local-test" }, sound: false }, trigger: null });
      setBubbleTestMessage("A local test notification was posted. This does not test remote message delivery or replies.");
    } catch { setBubbleTestMessage("The local test notification could not be posted."); }
  };

  const updateChatNotifications = async (update: Partial<ChatSettingsResponse["notifications"]>) => {
    setBusyKey("chat"); setError(null);
    try {
      const response = await request<ChatSettingsResponse>("/api/v1/chat/settings", { method: "PATCH", body: { notifications: update } });
      setChatSettings(response.notifications);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update message notifications."); }
    finally { setBusyKey(null); }
  };

  const togglePush = async (enabled: boolean) => {
    setBusyKey("push"); setError(null);
    try {
      if (enabled) {
        await enableMessengerPush(request);
        await configureMessengerNotificationActions(bubbleSettings.interactiveNotifications);
        setPushEnabled(true);
      } else {
        await disableMessengerPush(request);
        setPushEnabled(false);
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update notification permission."); }
    finally { setBusyKey(null); }
  };

  const toggleInteractive = async (enabled: boolean) => {
    setBusyKey("interactive"); setError(null);
    try {
      await configureMessengerNotificationActions(enabled);
      setBubbleSettings(await saveChatBubblePreferences({ interactiveNotifications: enabled }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update notification actions."); }
    finally { setBusyKey(null); }
  };

  return (
    <ScreenFrame title="Settings" eyebrow="NANTTY MESSENGER" backgroundColor={colors.background}>
      <View style={styles.content}>
        <View style={[styles.accountCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.accountMark, { backgroundColor: colors.brandTint }]}>
            <ShieldCheck size={24} color={colors.brand} weight="regular" />
          </View>
          <View style={styles.accountCopy}>
            <Text style={[styles.name, { color: colors.text }]}>{user?.name || "Nantty account"}</Text>
            {user?.username ? <Text style={[styles.handle, { color: colors.muted }]}>@{user.username}</Text> : null}
            <Text style={[styles.helper, { color: colors.muted }]}>This app signs in to the same Nantty identity with its own device session.</Text>
          </View>
        </View>
        <View style={[styles.note, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.noteTitle, { color: colors.text }]}>Private by design</Text>
          <Text style={[styles.noteCopy, { color: colors.muted }]}>Messenger has no advertisements. Your refresh token is kept in device secure storage and removed when you sign out.</Text>
        </View>
        <View style={[styles.settingsSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.sectionHeading}><ChatCircleDots size={19} color={colors.brand} /><Text style={[styles.sectionTitle, { color: colors.text }]}>Chat bubbles</Text></View>
          <Text style={[styles.sectionCopy, { color: colors.muted }]}>{Platform.OS === "ios" ? "Floating conversations stay inside Nantty Messenger. iOS does not provide system-wide chat bubbles." : "In-app floating conversations and Android system bubbles are separate. Android availability also depends on notification and system bubble settings."}</Text>
          {Platform.OS === "android" ? <SettingToggle label="Android system bubbles" description="Allow eligible conversation notifications to use Android’s Bubbles feature when the device and system settings permit it." value={bubbleSettings.enabled} disabled={busyKey !== null} onChange={requestSystemBubbleEnable} /> : null}
          {Platform.OS === "android" ? <View style={[styles.bubbleStatus, { borderTopColor: colors.border }]}>
            <Text style={[styles.toggleLabel, { color: colors.text }]}>Android availability</Text>
            <Text accessibilityLiveRegion="polite" style={[styles.toggleDescription, { color: colors.muted }]}>{bubbleStatusLabel(androidBubbleCapabilities)}</Text>
            <View style={styles.nativeActions}>
              <Pressable accessibilityRole="button" onPress={() => void openAndroidBubbleSettings()} style={[styles.nativeAction, { borderColor: colors.border }]}>
                <Text style={[styles.nativeActionText, { color: colors.text }]}>Open Android settings</Text>
              </Pressable>
              <Pressable accessibilityRole="button" disabled={!androidBubbleCapabilities?.systemBubblesSupported || !androidBubbleCapabilities.notificationsEnabled} onPress={() => {
                setBubbleTestMessage(null);
                void sendAndroidBubbleTest().then((result) => {
                  setBubbleTestMessage(result.status === "posted_eligible"
                    ? "Test notification posted and eligible. Android may still require you to tap or promote it as a bubble."
                    : result.notificationPosted
                      ? "Test notification posted, but Android settings may prevent it from opening as a bubble."
                      : result.status === "notification_permission_required"
                        ? "Allow notifications in Android settings before running the test."
                        : "System bubble test is unavailable on this device.");
                }).catch(() => setBubbleTestMessage("The test notification could not be posted."));
              }} style={[styles.nativeAction, { borderColor: colors.border }, (!androidBubbleCapabilities?.systemBubblesSupported || !androidBubbleCapabilities.notificationsEnabled) && styles.disabledAction]}>
                <Text style={[styles.nativeActionText, { color: colors.text }]}>Test chat bubble</Text>
              </Pressable>
            </View>
            {bubbleTestMessage ? <Text accessibilityLiveRegion="polite" style={[styles.toggleDescription, { color: colors.muted }]}>{bubbleTestMessage}</Text> : null}
          </View> : null}
          <SettingToggle label="In-app floating conversations" description="Keep conversations you choose available while using Messenger. These bubbles never appear over other apps." value={bubbleSettings.inAppEnabled} disabled={busyKey !== null} onChange={async (inAppEnabled) => {
            setBusyKey("inApp"); setError(null);
            try { const saved = await saveChatBubblePreferences({ inAppEnabled }); setBubbleSettings(saved); }
            catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update in-app conversations."); }
            finally { setBusyKey(null); }
          }} />
          {Platform.OS === "android" ? <View style={[styles.modePicker, { borderColor: colors.border }]}>
            <ModeOption label="None" selected={bubbleSettings.mode === "selected" && bubbleSettings.conversationIds.length === 0} onPress={() => void saveBubbles({ mode: "selected", conversationIds: [] })} />
            <ModeOption label="Selected chats" selected={bubbleSettings.mode === "selected" && bubbleSettings.conversationIds.length > 0} onPress={() => void saveBubbles({ mode: "selected" })} />
            <ModeOption label="All chats" selected={bubbleSettings.mode === "all"} onPress={() => void saveBubbles({ mode: "all" })} />
          </View> : null}
          <SettingToggle label="Show unread counts" value={bubbleSettings.showUnreadCount} disabled={busyKey !== null} onChange={(showUnreadCount) => void saveBubbles({ showUnreadCount })} />
          {Platform.OS === "android" ? bubbleSettings.mode === "selected" ? <Pressable accessibilityRole="button" onPress={() => void openConversationPicker()} style={[styles.manageButton, { borderColor: colors.border }]}><Text style={[styles.nativeActionText, { color: colors.text }]}>Choose conversations ({bubbleSettings.conversationIds.length})</Text></Pressable> : <Pressable accessibilityRole="button" onPress={() => void openConversationPicker()} style={[styles.manageButton, { borderColor: colors.border }]}><Text style={[styles.nativeActionText, { color: colors.text }]}>Manage exclusions ({bubbleSettings.excludedConversationIds.length})</Text></Pressable> : <Text style={[styles.hint, { color: colors.muted }]}>To add or remove an in-app floating conversation, use the chat-bubble action in that conversation.</Text>}
          <Pressable accessibilityRole="button" onPress={() => { setSetupStep(3); setSetupVisible(true); }} style={[styles.helpLink, { borderTopColor: colors.border }]}><Text style={[styles.nativeActionText, { color: colors.brand }]}>Help and troubleshooting</Text></Pressable>
        </View>
        <View style={[styles.settingsSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.sectionHeading}><Bell size={19} color={colors.brand} /><Text style={[styles.sectionTitle, { color: colors.text }]}>Message notifications</Text></View>
          <SettingToggle label="Direct and business message alerts" description="Allow new messages from one-to-one and business conversations to alert this account." value={chatSettings.messages} disabled={busyKey !== null} onChange={(messages) => void updateChatNotifications({ messages })} />
          <SettingToggle label="Group message alerts" description="Allow new group and channel messages to alert this account." value={chatSettings.groups} disabled={busyKey !== null} onChange={(groups) => void updateChatNotifications({ groups })} />
          <SettingToggle label="Push notifications on this device" description="Required for new-message alerts when Messenger is closed." value={pushEnabled} disabled={busyKey !== null} onChange={(enabled) => void togglePush(enabled)} />
          <SettingToggle label="Reply and mark as read" description="Replies open Messenger and are encrypted before sending. They never use a plaintext fallback." value={bubbleSettings.interactiveNotifications} disabled={busyKey !== null || !pushEnabled} onChange={(enabled) => void toggleInteractive(enabled)} />
          <SettingToggle label="Show sender and conversation names" description="Message contents remain private and are never included in push notifications." value={chatSettings.showMessagePreview} disabled={busyKey !== null} onChange={(showMessagePreview) => void updateChatNotifications({ showMessagePreview })} />
          <Pressable accessibilityRole="button" onPress={() => void sendLocalNotificationTest()} style={[styles.deviceSettings, { borderTopColor: colors.border }]}><View style={styles.toggleCopy}><Text style={[styles.toggleLabel, { color: colors.text }]}>Test notifications</Text><Text style={[styles.toggleDescription, { color: colors.muted }]}>Posts a local test alert; it does not contact a sender or verify remote delivery.</Text></View><Text style={[styles.deviceSettingsAction, { color: colors.brand }]}>Send test</Text></Pressable>
          {Platform.OS === "ios" && bubbleTestMessage ? <Text accessibilityLiveRegion="polite" style={[styles.toggleDescription, { color: colors.muted }]}>{bubbleTestMessage}</Text> : null}
          <SettingToggle label="Notification sound" value={chatSettings.sound} disabled={busyKey !== null} onChange={(sound) => void updateChatNotifications({ sound })} />
          {Platform.OS === "android" ? <SettingToggle label="Vibration" value={chatSettings.vibration} disabled={busyKey !== null} onChange={(vibration) => void updateChatNotifications({ vibration })} /> : <Text style={[styles.hint, { color: colors.muted }]}>Vibration follows iOS notification and device settings.</Text>}
          {!pushEnabled ? <Text style={[styles.hint, { color: colors.muted }]}>Allow notifications above, then manage lock-screen previews in your device settings.</Text> : null}
          <Pressable accessibilityRole="button" onPress={() => void Linking.openSettings()} style={[styles.deviceSettings, { borderTopColor: colors.border }]}>
            <View style={styles.toggleCopy}>
              <Text style={[styles.toggleLabel, { color: colors.text }]}>Lock-screen privacy</Text>
              <Text style={[styles.toggleDescription, { color: colors.muted }]}>Message text is never sent in notifications. Manage whether Nantty alerts appear on your lock screen in device settings.</Text>
            </View>
            <Text style={[styles.deviceSettingsAction, { color: colors.brand }]}>Open settings</Text>
          </Pressable>
        </View>
        {error ? <Text accessibilityRole="alert" style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
        <Pressable accessibilityRole="button" onPress={() => void signOut()} style={({ pressed }) => [styles.signOut, { borderColor: colors.border }, pressed && styles.pressed]}>
          <SignOut size={19} color={colors.danger} />
          <Text style={[styles.signOutText, { color: colors.danger }]}>Sign out</Text>
        </Pressable>
      </View>
      <Modal visible={setupVisible} transparent animationType="slide" onRequestClose={() => setSetupVisible(false)}>
        <View style={styles.modalBackdrop}><View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {setupStep === 0 ? <><Text style={[styles.modalTitle, { color: colors.text }]}>Chat bubbles</Text><View style={[styles.setupPreview, { borderColor: colors.border }]}><ChatCircleDots size={24} color={colors.brand} /><View style={styles.toggleCopy}><Text style={[styles.toggleLabel, { color: colors.text }]}>New message</Text><Text style={[styles.toggleDescription, { color: colors.muted }]}>Open a conversation while using another app</Text></View></View><Text style={[styles.modalCopy, { color: colors.muted }]}>Chat bubbles let you open and reply to conversations while using other apps. Android controls whether eligible conversations can appear as bubbles; Nantty cannot override those system settings.</Text><View style={styles.nativeActions}><Pressable accessibilityRole="button" onPress={() => setSetupVisible(false)} style={[styles.nativeAction, { borderColor: colors.border }]}><Text style={[styles.nativeActionText, { color: colors.text }]}>Not now</Text></Pressable><Pressable accessibilityRole="button" onPress={() => setSetupStep(1)} style={[styles.nativeAction, { borderColor: colors.brand }]}><Text style={[styles.nativeActionText, { color: colors.brand }]}>Continue</Text></Pressable></View></> : null}
          {setupStep === 1 ? <><Text style={[styles.modalTitle, { color: colors.text }]}>Allow notifications</Text><Text style={[styles.modalCopy, { color: colors.muted }]}>Android needs notification permission before Nantty can post a conversation bubble. You can change this any time in system settings.</Text><View style={styles.nativeActions}><Pressable accessibilityRole="button" onPress={() => setSetupVisible(false)} style={[styles.nativeAction, { borderColor: colors.border }]}><Text style={[styles.nativeActionText, { color: colors.text }]}>Not now</Text></Pressable><Pressable accessibilityRole="button" disabled={busyKey !== null} onPress={() => void completeSetup()} style={[styles.nativeAction, { borderColor: colors.brand }]}><Text style={[styles.nativeActionText, { color: colors.brand }]}>{busyKey === "setup" ? "Checking…" : "Allow and continue"}</Text></Pressable></View></> : null}
          {setupStep === 2 ? <><Text style={[styles.modalTitle, { color: colors.text }]}>Finish in Android settings</Text><Text style={[styles.modalCopy, { color: colors.muted }]}>Android currently blocks bubbles for Nantty. Enable the available conversation bubble preference, return here, then continue. Nantty cannot change this setting on your behalf.</Text><View style={styles.nativeActions}><Pressable accessibilityRole="button" onPress={() => { setSetupStep(1); void completeSetup(); }} style={[styles.nativeAction, { borderColor: colors.border }]}><Text style={[styles.nativeActionText, { color: colors.text }]}>Check again</Text></Pressable><Pressable accessibilityRole="button" onPress={() => void openAndroidBubbleSettings()} style={[styles.nativeAction, { borderColor: colors.brand }]}><Text style={[styles.nativeActionText, { color: colors.brand }]}>Open settings</Text></Pressable></View></> : null}
          {setupStep === 3 ? <><Text style={[styles.modalTitle, { color: colors.text }]}>Chat bubbles help</Text><Text style={[styles.modalCopy, { color: colors.muted }]}>Android system bubbles are controlled by Android and may require you to promote an eligible conversation notification. In-app bubbles stay inside Messenger. On iPhone, only in-app bubbles and notification actions are available. Muted chats follow your notification preferences; message contents are not sent in push alerts.</Text><Text style={[styles.modalCopy, { color: colors.muted }]}>Current status: {Platform.OS === "android" ? bubbleStatusLabel(androidBubbleCapabilities) : "iOS supports in-app bubbles only."}</Text><Pressable accessibilityRole="button" onPress={() => setSetupVisible(false)} style={[styles.nativeAction, { borderColor: colors.border, alignSelf: "flex-end" }]}><Text style={[styles.nativeActionText, { color: colors.text }]}>Done</Text></Pressable></> : null}
          {setupStep === 4 ? <><Text style={[styles.modalTitle, { color: colors.text }]}>System bubbles unavailable</Text><Text style={[styles.modalCopy, { color: colors.muted }]}>This Android version does not support system-wide chat bubbles. You can still use in-app floating conversations and standard notifications.</Text><Pressable accessibilityRole="button" onPress={() => setSetupVisible(false)} style={[styles.nativeAction, { borderColor: colors.border, alignSelf: "flex-end" }]}><Text style={[styles.nativeActionText, { color: colors.text }]}>Done</Text></Pressable></> : null}
          {setupStep === 5 ? <><Text style={[styles.modalTitle, { color: colors.text }]}>Message notifications are off</Text><Text style={[styles.modalCopy, { color: colors.muted }]}>Your account currently disables direct and group message alerts, so new messages cannot reach bubbles. Close this guide and enable the message types you want in the settings list.</Text><Pressable accessibilityRole="button" onPress={() => setSetupVisible(false)} style={[styles.nativeAction, { borderColor: colors.brand, alignSelf: "flex-end" }]}><Text style={[styles.nativeActionText, { color: colors.brand }]}>Done</Text></Pressable></> : null}
          {setupStep === 6 ? <><Text style={[styles.modalTitle, { color: colors.text }]}>System bubbles aren't available here</Text><Text style={[styles.modalCopy, { color: colors.muted }]}>This installation cannot access Android's bubble feature. Use the supported Nantty Messenger Android build. In-app floating conversations and standard notifications are separate.</Text><Pressable accessibilityRole="button" onPress={() => setSetupVisible(false)} style={[styles.nativeAction, { borderColor: colors.border, alignSelf: "flex-end" }]}><Text style={[styles.nativeActionText, { color: colors.text }]}>Done</Text></Pressable></> : null}
          {setupMessage ? <Text accessibilityRole="alert" style={[styles.toggleDescription, { color: colors.danger }]}>{setupMessage}</Text> : null}
        </View></View>
      </Modal>
      <Modal visible={pickerVisible} animationType="slide" onRequestClose={() => setPickerVisible(false)}>
        <SafeAreaView edges={["top", "bottom"]} style={[styles.pickerRoot, { backgroundColor: colors.background }]}>
          <KeyboardAvoidingView style={styles.pickerKeyboard} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={styles.pickerHeader}><Text accessibilityRole="header" style={[styles.modalTitle, { color: colors.text }]}>{bubbleSettings.mode === "all" ? "Manage exclusions" : "Choose conversations"}</Text><Pressable accessibilityRole="button" onPress={() => setPickerVisible(false)}><Text style={[styles.nativeActionText, { color: colors.brand }]}>Close</Text></Pressable></View>
          <Text style={[styles.modalCopy, { color: colors.muted }]}>{bubbleSettings.mode === "all" ? "Excluded conversations will not use a bubble. Only conversations you can access are listed." : "Only conversations you can access are listed. Muted and blocked conversations continue to follow your existing notification settings."}</Text>
          <TextInput accessibilityLabel="Search conversations" value={pickerSearch} onChangeText={setPickerSearch} placeholder="Search by name or username" placeholderTextColor={colors.subtle} style={[styles.pickerSearch, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]} />
          {pickerLoading ? <ActivityIndicator color={colors.brand} style={{ marginTop: 24 }} /> : pickerError ? <Text accessibilityRole="alert" style={[styles.error, { color: colors.danger }]}>{pickerError}</Text> : <FlatList data={filteredPickerConversations} keyExtractor={(item) => item.id} renderItem={({ item }) => { const selected = selectedIds.includes(item.id); return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={() => togglePickedConversation(item.id)} style={[styles.pickerRow, { borderBottomColor: colors.border }]}><View style={{ flex: 1 }}><Text style={[styles.toggleLabel, { color: colors.text }]} numberOfLines={1}>{conversationDisplayName(item)}</Text><Text style={[styles.toggleDescription, { color: colors.muted }]} numberOfLines={1}>@{item.peer.username}</Text></View><Text style={{ color: selected ? colors.brand : colors.muted }}>{selected ? "Selected" : "Select"}</Text></Pressable>; }} ListEmptyComponent={<Text style={[styles.modalCopy, { color: colors.muted }]}>No conversations found.</Text>} />}
          <Pressable accessibilityRole="button" onPress={() => { const update = bubbleSettings.mode === "all" ? { excludedConversationIds: selectedIds } : { mode: "selected" as const, conversationIds: selectedIds }; void saveBubbles(update).then((saved) => { if (saved) setPickerVisible(false); }); }} style={[styles.saveSelection, { backgroundColor: colors.brand }]}><Text style={{ color: colors.onBrand, fontWeight: "700" }}>{bubbleSettings.mode === "all" ? "Save exclusions" : `Save selection (${selectedIds.length})`}</Text></Pressable>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </ScreenFrame>
  );
}

function SettingToggle({ label, description, value, disabled, onChange }: { readonly label: string; readonly description?: string; readonly value: boolean; readonly disabled: boolean; readonly onChange: (value: boolean) => void }) {
  const colors = useMessengerColors();
  return <View style={[styles.toggleRow, { borderTopColor: colors.border }]}>
    <View style={styles.toggleCopy}><Text style={[styles.toggleLabel, { color: colors.text }]}>{label}</Text>{description ? <Text style={[styles.toggleDescription, { color: colors.muted }]}>{description}</Text> : null}</View>
    <Switch accessibilityLabel={label} value={value} disabled={disabled} onValueChange={onChange} trackColor={{ false: colors.border, true: colors.brand }} thumbColor={colors.surface} />
  </View>;
}

function ModeOption({ label, selected, onPress }: { readonly label: string; readonly selected: boolean; readonly onPress: () => void }) {
  const colors = useMessengerColors();
  return <Pressable accessibilityRole="radio" accessibilityState={{ selected }} onPress={onPress} style={[styles.modeOption, selected && { backgroundColor: colors.brandTint }]}><Text style={[styles.modeText, { color: selected ? colors.brand : colors.muted }]}>{label}</Text></Pressable>;
}

function bubbleStatusLabel(capabilities: AndroidBubbleCapabilities | null): string {
  if (!capabilities) return "Checking Android notification and bubble settings…";
  if (capabilities.status === "unsupported") return "System bubbles require Android 11 or later. In-app floating conversations remain available.";
  if (capabilities.status === "notification_permission_required") return "Messenger notifications are disabled. Enable them before testing system bubbles.";
  if (capabilities.status === "system_bubbles_disabled") return "Android system bubble settings currently prevent Nantty from showing system bubbles.";
  if (capabilities.status === "ready") return "Android supports bubbles and its current app-level setting allows them. A conversation or channel can still be individually restricted.";
  return "Android bubble capability could not be checked in this build.";
}

const styles = StyleSheet.create({
  content: { padding: 18, gap: 14 },
  accountCard: { flexDirection: "row", alignItems: "flex-start", gap: 13, padding: 16, borderWidth: StyleSheet.hairlineWidth, borderRadius: 16 },
  accountMark: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  accountCopy: { flex: 1, gap: 4 },
  name: { fontSize: 16, lineHeight: 22, fontWeight: "700" },
  handle: { fontSize: 13, lineHeight: 18 },
  helper: { fontSize: 12, lineHeight: 18, marginTop: 5 },
  note: { padding: 16, borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, gap: 6 },
  noteTitle: { fontSize: 14, lineHeight: 20, fontWeight: "700" },
  noteCopy: { fontSize: 13, lineHeight: 19 },
  signOut: { minHeight: 46, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 },
  signOutText: { fontSize: 14, fontWeight: "700" },
  pressed: { opacity: 0.7 },
  settingsSection: { paddingHorizontal: 15, borderWidth: StyleSheet.hairlineWidth, borderRadius: 15 },
  sectionHeading: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 9 },
  sectionTitle: { fontSize: 15, fontWeight: "700" },
  sectionCopy: { fontSize: 12, lineHeight: 18, paddingBottom: 6 },
  toggleRow: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: 12, borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 8 },
  toggleCopy: { flex: 1, gap: 3 },
  toggleLabel: { fontSize: 13, fontWeight: "600" },
  toggleDescription: { fontSize: 11, lineHeight: 16 },
  deviceSettings: { minHeight: 62, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, marginTop: 12, flexDirection: "row", alignItems: "center", gap: 12 },
  deviceSettingsAction: { fontSize: 12, fontWeight: "700" },
  modePicker: { flexDirection: "row", borderWidth: StyleSheet.hairlineWidth, borderRadius: 11, padding: 3, marginVertical: 5 },
  modeOption: { flex: 1, minHeight: 34, alignItems: "center", justifyContent: "center", borderRadius: 8 },
  modeText: { fontSize: 12, fontWeight: "600" },
  bubbleStatus: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 12, gap: 6 },
  nativeActions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  nativeAction: { minHeight: 38, paddingHorizontal: 11, borderWidth: StyleSheet.hairlineWidth, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  nativeActionText: { fontSize: 11, fontWeight: "600" },
  disabledAction: { opacity: 0.45 },
  hint: { fontSize: 11, lineHeight: 16, paddingBottom: 10 },
  error: { fontSize: 12, lineHeight: 17 },
  manageButton: { minHeight: 40, borderWidth: StyleSheet.hairlineWidth, borderRadius: 9, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  helpLink: { minHeight: 48, borderTopWidth: StyleSheet.hairlineWidth, justifyContent: "center" },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.35)" },
  modalCard: { padding: 20, paddingBottom: 32, borderTopLeftRadius: 18, borderTopRightRadius: 18, borderWidth: StyleSheet.hairlineWidth, gap: 12 },
  modalTitle: { fontSize: 18, lineHeight: 24, fontWeight: "700" },
  modalCopy: { fontSize: 13, lineHeight: 19 },
  pickerRoot: { flex: 1, paddingTop: 12, paddingHorizontal: 18, paddingBottom: 12 },
  pickerKeyboard: { flex: 1 },
  pickerHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  pickerSearch: { minHeight: 44, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 12, marginVertical: 12 },
  pickerRow: { minHeight: 58, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", gap: 12 },
  saveSelection: { minHeight: 48, borderRadius: 10, alignItems: "center", justifyContent: "center", marginTop: 12 },
  setupPreview: { minHeight: 62, borderWidth: StyleSheet.hairlineWidth, borderRadius: 11, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 12 },
});
