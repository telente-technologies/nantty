import { useEffect, useState } from "react";
import { ActivityIndicator, AppState, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { BellSimpleRingingIcon, DeviceMobileIcon, KeyIcon, ShieldCheckIcon } from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ApiError } from "../api/apiClient";
import { useMessengerAuth } from "../auth/AuthProvider";
import { useMessengerColors } from "../ui/useMessengerColors";
import { BrandLockup } from "../ui/BrandLockup";

type VerificationMethod = "approve" | "code";

export function DeviceAuthorizationScreen() {
  const colors = useMessengerColors();
  const insets = useSafeAreaInsets();
  const { authorization, pollAuthorization, verifyAuthorizationCode, requestRecoveryCode, verifyRecoveryCode, cancelAuthorization } = useMessengerAuth();
  const [method, setMethod] = useState<VerificationMethod>("approve");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [pollStatus, setPollStatus] = useState("pending");
  const [recovering, setRecovering] = useState(false);
  const authorizationEnded = pollStatus === "denied" || pollStatus === "expired";

  useEffect(() => {
    if (!authorization || recovering || pollStatus !== "pending") return;
    let cancelled = false;
    let inFlight = false;
    const check = async () => {
      if (cancelled || inFlight || AppState.currentState !== "active") return;
      inFlight = true;
      try {
        const next = await pollAuthorization();
        if (!cancelled) {
          setPollStatus(next);
          setProblem(null);
        }
      } catch (error) {
        if (!cancelled) setProblem(error instanceof ApiError ? error.message : "We can’t check this sign-in yet. Check your connection.");
      } finally { inFlight = false; }
    };
    void check();
    const timer = setInterval(() => void check(), 3500);
    return () => { cancelled = true; clearInterval(timer); };
  }, [authorization?.authorizationId, pollAuthorization, recovering, pollStatus]);

  if (!authorization) return null;
  if (recovering) return <RecoveryPanel onBack={() => setRecovering(false)} requestCode={requestRecoveryCode} verifyCode={verifyRecoveryCode} />;
  const submitCode = async () => {
    if (!/^\d{6}$/.test(code) || busy) return;
    setBusy(true);
    setProblem(null);
    try { await verifyAuthorizationCode(code); }
    catch (error) { setProblem(error instanceof ApiError ? error.message : "That code couldn’t be verified. Try again."); setCode(""); }
    finally { setBusy(false); }
  };

  const requestedAt = new Date(authorization.device.requestedAt);
  const expiry = new Date(authorization.expiresAt);
  const context = [authorization.device.name, platformName(authorization.device.platform), authorization.device.approximateLocation].filter(Boolean).join(" · ");

  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: colors.background }]} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: Math.max(insets.top, 22) + 12, paddingBottom: Math.max(insets.bottom, 20) + 20 }]} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          <BrandLockup />
          <View style={styles.heading}>
            <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Approve this device</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>For your security, confirm this Messenger sign-in from an existing Nantty session.</Text>
          </View>

          <View style={[styles.context, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.contextIcon, { backgroundColor: colors.brandTint }]}><DeviceMobileIcon size={21} color={colors.brand} /></View>
            <View style={styles.contextCopy}>
              <Text style={[styles.contextTitle, { color: colors.text }]}>{context || "New device"}</Text>
              <Text style={[styles.contextMeta, { color: colors.muted }]}>{Number.isNaN(requestedAt.getTime()) ? "Just now" : `Requested ${requestedAt.toLocaleString()}`}</Text>
              {authorization.device.approximateLocation ? <Text style={[styles.contextMeta, { color: colors.muted }]}>Approximate location: {authorization.device.approximateLocation}</Text> : null}
            </View>
          </View>

          {authorizationEnded ? (
            <View style={styles.endedState}>
              <Text accessibilityRole="alert" style={[styles.endedTitle, { color: colors.text }]}>
                {pollStatus === "denied" ? "Sign-in request denied" : "Sign-in request expired"}
              </Text>
              <Text style={[styles.waitingDetail, { color: colors.muted }]}>
                {pollStatus === "denied" ? "This device was not authorized. If that wasn’t you, secure your Nantty account." : "For your security, start again and approve the new request before it expires."}
              </Text>
              <Pressable accessibilityRole="button" onPress={cancelAuthorization} style={[styles.primaryButton, { backgroundColor: colors.brand }]}>
                <Text style={[styles.primaryButtonText, { color: colors.onBrand }]}>Return to sign in</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.methodList}>
                <MethodChoice
                  active={method === "approve"}
                  icon={<BellSimpleRingingIcon size={21} color={method === "approve" ? colors.brand : colors.muted} />}
                  title="Approve from Nantty"
                  detail="Open Nantty on a trusted device and approve or deny this request."
                  onPress={() => setMethod("approve")}
                  colors={colors}
                />
                <MethodChoice
                  active={method === "code"}
                  icon={<KeyIcon size={21} color={method === "code" ? colors.brand : colors.muted} />}
                  title="Use a verification code"
                  detail="Get a temporary code from Security settings in your signed-in Nantty app or website."
                  onPress={() => setMethod("code")}
                  colors={colors}
                />
              </View>

              {method === "approve" ? (
                <View style={styles.waiting}>
                  <ActivityIndicator color={colors.brand} />
                  <Text style={[styles.waitingTitle, { color: colors.text }]}>Waiting for approval</Text>
                  <Text style={[styles.waitingDetail, { color: colors.muted }]}>This request expires at {expiry.toLocaleTimeString()}.</Text>
                </View>
              ) : (
                <View style={styles.codeGroup}>
                  <Text style={[styles.label, { color: colors.text }]}>One-time verification code</Text>
                  <TextInput
                    accessibilityLabel="One-time verification code"
                    autoComplete="one-time-code"
                    editable={!busy}
                    keyboardType="number-pad"
                    maxLength={6}
                    onChangeText={(value) => setCode(value.replace(/\D/g, ""))}
                    onSubmitEditing={() => void submitCode()}
                    placeholder="Enter 6-digit code"
                    placeholderTextColor={colors.subtle}
                    returnKeyType="done"
                    style={[styles.codeInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                    value={code}
                  />
                  <Pressable accessibilityRole="button" accessibilityState={{ disabled: !/^\d{6}$/.test(code) || busy, busy }} disabled={!/^\d{6}$/.test(code) || busy} onPress={() => void submitCode()} style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.brand }, pressed && styles.pressed]}>
                    {busy ? <ActivityIndicator color={colors.onBrand} /> : <Text style={[styles.primaryButtonText, { color: colors.onBrand }]}>Verify and continue</Text>}
                  </Pressable>
                </View>
              )}

              {problem ? <Text accessibilityRole="alert" style={[styles.problem, { color: colors.danger }]}>{problem}</Text> : null}
              <Pressable accessibilityRole="button" onPress={() => { setProblem(null); setRecovering(true); }} style={styles.recovery}>
                <ShieldCheckIcon size={17} color={colors.muted} />
                <Text style={[styles.recoveryText, { color: colors.muted }]}>Can’t access a trusted device?</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={cancelAuthorization} style={styles.cancel}>
                <Text style={[styles.cancelText, { color: colors.brand }]}>Cancel sign-in</Text>
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function RecoveryPanel({ onBack, requestCode, verifyCode }: { readonly onBack: () => void; readonly requestCode: () => Promise<string>; readonly verifyCode: (code: string) => Promise<void> }) {
  const colors = useMessengerColors();
  const insets = useSafeAreaInsets();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const send = async () => {
    setBusy(true); setProblem(null);
    try { setSentTo(await requestCode()); }
    catch (error) { setProblem(error instanceof ApiError ? error.message : "We couldn’t start account recovery. Please try again."); }
    finally { setBusy(false); }
  };
  const verify = async () => {
    if (!/^\d{6}$/.test(code) || busy) return;
    setBusy(true); setProblem(null);
    try { await verifyCode(code); }
    catch (error) { setProblem(error instanceof ApiError ? error.message : "That recovery code couldn’t be verified. Try again."); setCode(""); }
    finally { setBusy(false); }
  };

  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: colors.background }]} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerStyle={[styles.recoveryScroll, { paddingTop: Math.max(insets.top, 22) + 12, paddingBottom: Math.max(insets.bottom, 20) + 20 }]} keyboardShouldPersistTaps="handled">
        <View style={styles.recoveryContent}>
          <Pressable accessibilityLabel="Back to device approval" accessibilityRole="button" hitSlop={10} onPress={onBack}><Text style={[styles.cancelText, { color: colors.brand }]}>‹  Back</Text></Pressable>
          <BrandLockup />
          <View style={styles.heading}>
            <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Recover device access</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>We’ll send a one-time code to the verified email on your Nantty account. This code approves only this Messenger sign-in.</Text>
          </View>
          {sentTo ? (
            <>
              <Text style={[styles.subtitle, { color: colors.muted }]}>Code sent to {sentTo}. Enter it here to continue.</Text>
              <TextInput accessibilityLabel="Account recovery code" autoComplete="one-time-code" editable={!busy} keyboardType="number-pad" maxLength={6} onChangeText={(value) => setCode(value.replace(/\D/g, ""))} onSubmitEditing={() => void verify()} placeholder="6-digit code" placeholderTextColor={colors.subtle} returnKeyType="done" style={[styles.codeInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} value={code} />
              <Pressable accessibilityRole="button" disabled={busy} onPress={() => void send()}><Text style={[styles.recoveryText, { color: colors.brand }]}>Send a new code</Text></Pressable>
            </>
          ) : null}
          {problem ? <Text accessibilityRole="alert" style={[styles.problem, { color: colors.danger }]}>{problem}</Text> : null}
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy || (!!sentTo && !/^\d{6}$/.test(code)), busy }} disabled={busy || (!!sentTo && !/^\d{6}$/.test(code))} onPress={() => void (sentTo ? verify() : send())} style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.brand }, pressed && styles.pressed]}>
            {busy ? <ActivityIndicator color={colors.onBrand} /> : <Text style={[styles.primaryButtonText, { color: colors.onBrand }]}>{sentTo ? "Verify and continue" : "Send recovery code"}</Text>}
          </Pressable>
          <Text style={[styles.waitingDetail, { color: colors.muted }]}>If you can’t access the verified email on your account, contact Nantty support to secure your account.</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function MethodChoice({ active, icon, title, detail, onPress, colors }: { readonly active: boolean; readonly icon: React.ReactNode; readonly title: string; readonly detail: string; readonly onPress: () => void; readonly colors: ReturnType<typeof useMessengerColors> }) {
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ checked: active }} onPress={onPress} style={[styles.method, { borderColor: active ? colors.brand : colors.border, backgroundColor: active ? colors.brandTint : colors.surface }]}>
      <View style={styles.methodIcon}>{icon}</View>
      <View style={styles.methodCopy}>
        <Text style={[styles.methodTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.methodDetail, { color: colors.muted }]}>{detail}</Text>
      </View>
      <View style={[styles.radio, { borderColor: active ? colors.brand : colors.border }]}>{active ? <View style={[styles.radioDot, { backgroundColor: colors.brand }]} /> : null}</View>
    </Pressable>
  );
}

function platformName(platform: string): string {
  if (platform.toLowerCase() === "ios") return "iOS";
  if (platform.toLowerCase() === "android") return "Android";
  return platform;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 22 },
  content: { width: "100%", maxWidth: 480, gap: 20 },
  heading: { gap: 8, marginTop: 8 },
  title: { fontFamily: "Inter_700Bold", fontSize: 25, lineHeight: 32, fontWeight: "700", letterSpacing: -0.6 },
  subtitle: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21 },
  context: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  contextIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  contextCopy: { flex: 1, gap: 3 },
  contextTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14, lineHeight: 19, fontWeight: "600" },
  contextMeta: { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 17 },
  methodList: { gap: 10 },
  method: { borderWidth: 1, borderRadius: 12, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  methodIcon: { width: 25, alignItems: "center" },
  methodCopy: { flex: 1, gap: 4 },
  methodTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14, lineHeight: 19, fontWeight: "600" },
  methodDetail: { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 17 },
  radio: { width: 19, height: 19, borderWidth: 1.5, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  radioDot: { width: 9, height: 9, borderRadius: 5 },
  waiting: { minHeight: 112, alignItems: "center", justifyContent: "center", gap: 8 },
  endedState: { gap: 12 },
  endedTitle: { fontFamily: "Inter_600SemiBold", fontSize: 16, lineHeight: 22, fontWeight: "600" },
  waitingTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14, fontWeight: "600" },
  waitingDetail: { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 17, textAlign: "center" },
  codeGroup: { gap: 10 },
  label: { fontFamily: "Inter_600SemiBold", fontSize: 13, lineHeight: 18, fontWeight: "600" },
  codeInput: { fontFamily: "Inter_600SemiBold", minHeight: 50, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 14, textAlign: "center", letterSpacing: 7, fontSize: 18 },
  primaryButton: { minHeight: 48, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  primaryButtonText: { fontFamily: "Inter_700Bold", fontSize: 14, fontWeight: "700" },
  pressed: { opacity: 0.82 },
  problem: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 19 },
  recovery: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 4 },
  recoveryText: { fontFamily: "Inter_400Regular", fontSize: 12 },
  cancel: { alignSelf: "center", paddingVertical: 8, paddingHorizontal: 12 },
  cancelText: { fontFamily: "Inter_600SemiBold", fontSize: 13, fontWeight: "600" },
  recoveryScroll: { flexGrow: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 22 },
  recoveryContent: { width: "100%", maxWidth: 480, gap: 20 },
});
