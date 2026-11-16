import { useCallback, useEffect, useState, type ComponentType, type ReactNode } from "react";
import { ActivityIndicator, AppState, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Notifications from "expo-notifications";
import { ArrowLeft, ArrowClockwise, Bell, ChatCircleDots, GearSix, ShieldCheck } from "phosphor-react-native";

import { useMessengerAuth } from "../auth/AuthProvider";
import { getAndroidBubbleCapabilities, getAndroidConversationChannelStatus, openAndroidBubbleSettings, sendAndroidBubbleTest, type AndroidBubbleCapabilities, type AndroidConversationChannelStatus } from "../api/chatBubblesNative.service";
import { conversationDisplayName, parseConversationList, type ConversationSummary } from "../api/conversations";
import { getMessengerPushEnabled } from "../api/messengerNotifications.service";
import { ScreenFrame } from "../ui/ScreenFrame";
import { useMessengerColors } from "../ui/useMessengerColors";
import { androidBubblePreferenceLabel, androidConversationChannelDescription } from "./chatBubblesTroubleshooting.util";

interface ChatNotificationPreferences {
  readonly notifications: {
    readonly messages: boolean;
    readonly groups: boolean;
    readonly bubbles: boolean;
    readonly bubbleMode: "all" | "selected";
    readonly bubbleConversationIds: readonly string[];
    readonly bubbleExcludedConversationIds: readonly string[];
  };
}

interface Props {
  readonly onBack: () => void;
}

export function ChatBubblesTroubleshootingScreen({ onBack }: Props) {
  const colors = useMessengerColors();
  const { request, status: authStatus, user } = useMessengerAuth();
  const [permission, setPermission] = useState("Checking notification permission…");
  const [pushStatus, setPushStatus] = useState("Checking push registration…");
  const [chatStatus, setChatStatus] = useState("Checking message preferences…");
  const [systemStatus, setSystemStatus] = useState<AndroidBubbleCapabilities | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [channelPickerVisible, setChannelPickerVisible] = useState(false);
  const [channelSearch, setChannelSearch] = useState("");
  const [channelCandidates, setChannelCandidates] = useState<readonly ConversationSummary[]>([]);
  const [channelStatus, setChannelStatus] = useState<AndroidConversationChannelStatus | null>(null);
  const [channelConversation, setChannelConversation] = useState<string | null>(null);
  const [channelLoading, setChannelLoading] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    const results = await Promise.allSettled([
      Notifications.getPermissionsAsync(),
      getMessengerPushEnabled(),
      request<ChatNotificationPreferences>("/api/v1/chat/settings"),
      Platform.OS === "android" ? getAndroidBubbleCapabilities() : Promise.resolve(null),
    ]);
    const [permissionResult, pushResult, chatResult, bubbleResult] = results;
    if (permissionResult.status === "fulfilled") {
      const current = permissionResult.value;
      setPermission(current.granted ? "Allowed by the operating system" : current.canAskAgain ? "Not granted; Messenger has not opened system settings" : "Blocked; enable notifications in system settings");
    } else setPermission("Could not read notification permission");
    if (pushResult.status === "fulfilled") setPushStatus(pushResult.value ? "Push token registered and permission granted" : "Not registered, or notification permission is disabled");
    else setPushStatus("Could not verify push registration");
    if (chatResult.status === "fulfilled") {
      const { notifications } = chatResult.value;
      const messageTypes = [notifications.messages ? "direct/business" : null, notifications.groups ? "group" : null].filter(Boolean);
      const selection = notifications.bubbleMode === "all"
        ? `All conversations except ${notifications.bubbleExcludedConversationIds.length} excluded`
        : `${notifications.bubbleConversationIds.length} selected conversation${notifications.bubbleConversationIds.length === 1 ? "" : "s"}`;
      setChatStatus(`${notifications.bubbles ? "System bubbles requested" : "System bubbles turned off"}; ${messageTypes.length ? `${messageTypes.join(" and ")} alerts on` : "all message alert types off"}; ${selection}`);
    } else {
      setChatStatus("Could not load account message preferences");
      setError("Some account settings could not be checked. Refresh or try again when connected.");
    }
    if (bubbleResult.status === "fulfilled") setSystemStatus(bubbleResult.value);
    else if (Platform.OS === "android") setSystemStatus(null);
    setRefreshing(false);
  }, [request]);

  useEffect(() => {
    void refresh();
    const subscription = AppState.addEventListener("change", (state) => { if (state === "active") void refresh(); });
    return () => subscription.remove();
  }, [refresh]);

  const runTest = async () => {
    setTestStatus(null);
    const currentPermission = await Notifications.getPermissionsAsync().catch(() => null);
    if (!currentPermission?.granted) {
      setTestStatus("Test not sent: notification permission is off. Open system settings to enable it; Messenger will not prompt again from this test.");
      return;
    }
    if (Platform.OS === "android") {
      const result = await sendAndroidBubbleTest().catch(() => ({ status: "unavailable", notificationPosted: false, bubbleEligible: false }));
      setTestStatus(result.status === "posted_eligible"
        ? "Local bubble test notification posted and eligible. Android may still require you to tap or promote it; visibility cannot be confirmed by Messenger."
        : result.notificationPosted
          ? "Local test notification posted, but system settings may block its bubble."
          : `Local bubble test was not posted (${result.status}).`);
      return;
    }
    await Notifications.scheduleNotificationAsync({
      content: { title: "Nantty Messenger test", body: "Local notification test. No message was sent.", data: { type: "local-test" }, sound: false },
      trigger: null,
    }).then(() => setTestStatus("Local test notification posted. This does not verify remote delivery or notification replies."))
      .catch(() => setTestStatus("Could not post a local test notification."));
  };

  const loadChannelConversations = async () => {
    setChannelLoading(true);
    setError(null);
    try {
      const conversations = parseConversationList(await request<unknown>("/api/v1/conversations?filter=all"));
      setChannelCandidates(conversations);
      setChannelPickerVisible(true);
      if (conversations.length === 0) setChannelStatus({ status: "no_conversations", channelExists: false, canBubble: null, importance: null });
    } catch {
      setError("Could not load authorized conversations to inspect their notification channels.");
    } finally {
      setChannelLoading(false);
    }
  };

  const inspectChannel = async (conversation: ConversationSummary) => {
    setChannelConversation(conversationDisplayName(conversation));
    setChannelPickerVisible(false);
    setChannelStatus(await getAndroidConversationChannelStatus(user?.id ?? "", conversation.id));
  };

  const authMessage = authStatus === "signedIn"
    ? "Messenger session is signed in; conversation access remains subject to server membership checks."
    : "No active signed-in session. Complete Messenger device authorization before opening conversations.";

  return (
    <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: colors.background }}>
    <ScreenFrame title="Troubleshooting" eyebrow="CHAT BUBBLES" backgroundColor={colors.background}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to settings" onPress={onBack} style={styles.back}>
          <ArrowLeft size={18} color={colors.brand} /><Text style={[styles.action, { color: colors.brand }]}>Back to settings</Text>
        </Pressable>
        <Text style={[styles.intro, { color: colors.muted }]}>Check the current notification setup and use the recovery actions below. Operating-system controls are read-only here; Nantty cannot override them.</Text>
        <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <StatusRow Icon={Bell} title="Notification permission" detail={permission} colors={colors} />
          <StatusRow Icon={Bell} title="Push registration" detail={pushStatus} colors={colors} />
          <StatusRow Icon={ChatCircleDots} title="Message and bubble preferences" detail={chatStatus} colors={colors} />
          <StatusRow Icon={ShieldCheck} title="Account and device authorization" detail={authMessage} colors={colors} />
          {Platform.OS === "android" ? <StatusRow Icon={GearSix} title="Android system bubbles" detail={bubbleStatus(systemStatus)} colors={colors} /> : <StatusRow Icon={ChatCircleDots} title="System-wide bubbles" detail="Not supported by iOS. In-app floating conversations and notification actions are the supported options." colors={colors} />}
          <StatusRow Icon={GearSix} title="Conversation notification channel" detail={Platform.OS === "android" ? channelStatus ? androidConversationChannelDescription(channelConversation, channelStatus) : "Check the channel Android uses for an authorized conversation." : "iOS notification delivery and grouping are controlled in the system notification settings."} colors={colors} />
        </View>
        {error ? <Text accessibilityRole="alert" style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
        {testStatus ? <Text accessibilityLiveRegion="polite" style={[styles.detail, { color: colors.muted }]}>{testStatus}</Text> : null}
        <View style={styles.actions}>
          <Action label={refreshing ? "Refreshing…" : "Refresh status"} disabled={refreshing} onPress={() => void refresh()} colors={colors}>
            {refreshing ? <ActivityIndicator size="small" color={colors.brand} /> : <ArrowClockwise size={17} color={colors.brand} />}
          </Action>
          {Platform.OS === "android" ? <Action label="Open Android bubble settings" onPress={() => void openAndroidBubbleSettings()} colors={colors}><GearSix size={17} color={colors.brand} /></Action> : null}
          {Platform.OS === "android" ? <Action label={channelLoading ? "Loading conversations…" : "Check conversation channel"} disabled={channelLoading} onPress={() => void loadChannelConversations()} colors={colors}>{channelLoading ? <ActivityIndicator size="small" color={colors.brand} /> : <ChatCircleDots size={17} color={colors.brand} />}</Action> : null}
          <Action label="Open notification settings" onPress={() => void Linking.openSettings()} colors={colors}><Bell size={17} color={colors.brand} /></Action>
          <Action label="Send local test" onPress={() => void runTest()} colors={colors}><ChatCircleDots size={17} color={colors.brand} /></Action>
        </View>
        <Text style={[styles.detail, { color: colors.muted }]}>If notifications are disabled, turn them on in device settings. If Android bubbles are disabled, enable the available bubble option there; some conversations may also need to be promoted from their notification. Muted conversations follow their notification preferences. Offline sending uses the existing secure message queue when available; notification replies still require a valid authorized session.</Text>
      </ScrollView>
      <Modal visible={channelPickerVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setChannelPickerVisible(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={styles.pickerHeader}><Text style={[styles.title, { color: colors.text }]}>Choose a conversation</Text><Pressable accessibilityRole="button" onPress={() => setChannelPickerVisible(false)}><Text style={[styles.action, { color: colors.brand }]}>Close</Text></Pressable></View>
          <TextInput accessibilityLabel="Search conversations" value={channelSearch} onChangeText={setChannelSearch} placeholder="Search conversations" placeholderTextColor={colors.muted} style={[styles.search, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]} />
          <ScrollView keyboardShouldPersistTaps="handled">
            {channelCandidates.filter((item) => conversationDisplayName(item).toLocaleLowerCase().includes(channelSearch.trim().toLocaleLowerCase())).map((item) => (
              <Pressable key={item.id} accessibilityRole="button" onPress={() => void inspectChannel(item)} style={[styles.conversation, { borderBottomColor: colors.border }]}>
                <Text style={[styles.title, { color: colors.text }]}>{conversationDisplayName(item)}</Text>
                <Text numberOfLines={1} style={[styles.detail, { color: colors.muted }]}>{item.lastMessage || "No messages yet"}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </ScreenFrame>
    </SafeAreaView>
  );
}

function bubbleStatus(capabilities: AndroidBubbleCapabilities | null): string {
  if (!capabilities) return "Status unavailable in this build or still loading.";
  if (!capabilities.systemBubblesSupported) return "This Android version does not support system bubbles; standard notifications and in-app conversations remain available.";
  if (!capabilities.notificationsEnabled) return "App notifications are disabled or notification permission is missing.";
  if (!capabilities.systemBubblesEnabled) return `${androidBubblePreferenceLabel(capabilities.systemBubblePreference)}. Open Android settings to review it.`;
  return `${androidBubblePreferenceLabel(capabilities.systemBubblePreference)}. A conversation channel or user promotion may still prevent a bubble.`;
}

function StatusRow({ Icon, title, detail, colors }: { readonly Icon: ComponentType<{ readonly size?: number; readonly color?: string }>; readonly title: string; readonly detail: string; readonly colors: { readonly text: string; readonly muted: string; readonly brand: string; readonly border: string } }) {
  return <View style={[styles.row, { borderBottomColor: colors.border }]}><Icon size={18} color={colors.brand} /><View style={styles.copy}><Text style={[styles.title, { color: colors.text }]}>{title}</Text><Text style={[styles.detail, { color: colors.muted }]}>{detail}</Text></View></View>;
}

function Action({ label, disabled, onPress, colors, children }: { readonly label: string; readonly disabled?: boolean; readonly onPress: () => void; readonly colors: { readonly brand: string; readonly border: string; readonly surface: string }; readonly children: ReactNode }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.button, { borderColor: colors.border, backgroundColor: colors.surface }, disabled && { opacity: 0.6 }]}>{children}<Text style={[styles.action, { color: colors.brand }]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  content: { padding: 18, gap: 14 },
  back: { minHeight: 42, flexDirection: "row", alignItems: "center", gap: 8 },
  intro: { fontSize: 13, lineHeight: 19 },
  panel: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, paddingHorizontal: 14 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 11, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth },
  copy: { flex: 1, gap: 4 },
  title: { fontSize: 13, lineHeight: 18, fontWeight: "600" },
  detail: { fontSize: 12, lineHeight: 18 },
  actions: { gap: 8 },
  pickerHeader: { minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18 },
  search: { marginHorizontal: 16, marginBottom: 8, minHeight: 44, borderWidth: StyleSheet.hairlineWidth, borderRadius: 9, paddingHorizontal: 12 },
  conversation: { paddingHorizontal: 18, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 4 },
  button: { minHeight: 44, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, paddingHorizontal: 12 },
  action: { fontSize: 12, fontWeight: "600" },
  error: { fontSize: 12, lineHeight: 18 },
});
