import { useRef, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputInstance } from "react-native";
import { ArrowRightIcon, ArrowSquareOutIcon, EyeIcon, EyeSlashIcon, LockKeyIcon, XIcon } from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ApiError } from "../api/apiClient";
import { useMessengerAuth } from "../auth/AuthProvider";
import { useMessengerColors } from "../ui/useMessengerColors";
import { BrandLockup } from "../ui/BrandLockup";

const NANTTY_DOWNLOAD_PAGE = "https://nantty.com/#download";
const NANTTY_WEB_SIGN_UP = "https://web.nantty.com/signup";

interface SignInScreenProps {
  readonly onForgotPassword: () => void;
}

export function SignInScreen({ onForgotPassword }: SignInScreenProps) {
  const colors = useMessengerColors();
  const insets = useSafeAreaInsets();
  const { signIn } = useMessengerAuth();
  const identifierRef = useRef<TextInputInstance>(null);
  const passwordRef = useRef<TextInputInstance>(null);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [createAccountVisible, setCreateAccountVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canSubmit = identifier.trim().length > 0 && password.length > 0 && !pending;

  const submit = async () => {
    if (!canSubmit) return;
    setPending(true);
    setError(null);
    try {
      await signIn(identifier, password);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "We couldn’t sign you in. Please try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: colors.background }]} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: Math.max(insets.top, 24) + 20, paddingBottom: Math.max(insets.bottom, 24) + 20 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      >
        <View style={styles.content}>
          <BrandLockup />
          <View style={styles.heading}>
            <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Sign in to Messenger</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>Use the Nantty account you already have.</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Email, phone or username</Text>
              <TextInput
                accessibilityLabel="Email, phone or username"
                autoCapitalize="none"
                autoComplete="username"
                autoCorrect={false}
                editable={!pending}
                keyboardType="email-address"
                onChangeText={setIdentifier}
                onSubmitEditing={() => passwordRef.current?.focus()}
                placeholder="Email, phone or @username"
                placeholderTextColor={colors.subtle}
                ref={identifierRef}
                returnKeyType="next"
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                textContentType="username"
                value={identifier}
              />
            </View>
            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <Text style={[styles.label, { color: colors.text }]}>Password</Text>
                <Pressable accessibilityRole="button" disabled={pending} hitSlop={8} onPress={onForgotPassword}>
                  <Text style={[styles.link, { color: colors.brand }]}>Forgot password?</Text>
                </Pressable>
              </View>
              <View style={[styles.passwordBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <LockKeyIcon size={18} color={colors.muted} weight="regular" />
                <TextInput
                  accessibilityLabel="Password"
                  autoCapitalize="none"
                  autoComplete="current-password"
                  editable={!pending}
                  onChangeText={setPassword}
                  onSubmitEditing={() => void submit()}
                  placeholder="Enter your password"
                  placeholderTextColor={colors.subtle}
                  ref={passwordRef}
                  returnKeyType="go"
                  secureTextEntry={!passwordVisible}
                  style={[styles.passwordInput, { color: colors.text }]}
                  textContentType="password"
                  value={password}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={passwordVisible ? "Hide password" : "Show password"}
                  accessibilityState={{ disabled: pending }}
                  disabled={pending}
                  hitSlop={10}
                  onPress={() => setPasswordVisible((visible) => !visible)}
                >
                  {passwordVisible ? <EyeSlashIcon size={20} color={colors.muted} /> : <EyeIcon size={20} color={colors.muted} />}
                </Pressable>
              </View>
            </View>
          </View>

          {error ? <Text accessibilityRole="alert" style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSubmit, busy: pending }}
            disabled={!canSubmit}
            onPress={() => void submit()}
            style={({ pressed }) => [styles.submit, { backgroundColor: colors.brand }, (!canSubmit || pressed) && styles.submitMuted]}
          >
            {pending ? <ActivityIndicator color={colors.onBrand} /> : <Text style={[styles.submitText, { color: colors.onBrand }]}>Continue</Text>}
          </Pressable>

          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: colors.muted }]}>New to Nantty?</Text>
            <Pressable accessibilityRole="button" disabled={pending} onPress={() => setCreateAccountVisible(true)}>
              <Text style={[styles.link, { color: colors.brand }]}>Create an account</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
      <CreateAccountSheet
        visible={createAccountVisible}
        onClose={() => setCreateAccountVisible(false)}
        colors={colors}
      />
    </KeyboardAvoidingView>
  );
}

function CreateAccountSheet({ visible, onClose, colors }: { readonly visible: boolean; readonly onClose: () => void; readonly colors: ReturnType<typeof useMessengerColors> }) {
  const insets = useSafeAreaInsets();
  const open = async (url: string) => {
    onClose();
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert("Can’t open Nantty", "Please try again later or visit nantty.com in your browser.");
    }
  };

  return (
    <Modal animationType="slide" onRequestClose={onClose} presentationStyle="overFullScreen" transparent visible={visible}>
      <View style={styles.modalRoot}>
        <Pressable accessibilityLabel="Close create account sheet" accessibilityRole="button" onPress={onClose} style={styles.scrim} />
        <View style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, 20) }]}>
          <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
          <View style={styles.sheetHeader}>
            <View style={styles.sheetHeading}>
              <Text accessibilityRole="header" style={[styles.sheetTitle, { color: colors.text }]}>Join Nantty</Text>
              <Text style={[styles.subtitle, { color: colors.muted }]}>Create your account in Nantty, then come back to sign in here.</Text>
            </View>
            <Pressable accessibilityLabel="Close" accessibilityRole="button" hitSlop={10} onPress={onClose}>
              <XIcon size={22} color={colors.muted} />
            </Pressable>
          </View>
          <SheetAction
            title="Get Nantty on mobile"
            detail="See current availability or join the official waitlist."
            onPress={() => void open(NANTTY_DOWNLOAD_PAGE)}
            colors={colors}
          />
          <SheetAction
            title="Create an account on the web"
            detail="Continue to Nantty’s official website to register."
            onPress={() => void open(NANTTY_WEB_SIGN_UP)}
            colors={colors}
          />
        </View>
      </View>
    </Modal>
  );
}

function SheetAction({ title, detail, onPress, colors }: { readonly title: string; readonly detail: string; readonly onPress: () => void; readonly colors: ReturnType<typeof useMessengerColors> }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} style={({ pressed }) => [styles.sheetAction, { borderColor: colors.border, backgroundColor: colors.background }, pressed && styles.submitMuted]}>
      <View style={styles.sheetActionCopy}>
        <Text style={[styles.sheetActionTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.sheetActionDetail, { color: colors.muted }]}>{detail}</Text>
      </View>
      <View style={styles.sheetActionIcons}>
        <ArrowSquareOutIcon size={17} color={colors.muted} />
        <ArrowRightIcon size={17} color={colors.brand} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 24 },
  content: { width: "100%", maxWidth: 440, gap: 30 },
  heading: { gap: 8 },
  title: { fontFamily: "Inter_700Bold", fontSize: 27, lineHeight: 34, letterSpacing: -0.7 },
  subtitle: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21 },
  form: { gap: 20 },
  fieldGroup: { gap: 9 },
  labelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  label: { fontFamily: "Inter_600SemiBold", fontSize: 13, lineHeight: 18 },
  input: { fontFamily: "Inter_400Regular", minHeight: 48, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 14, fontSize: 15 },
  passwordBox: { minHeight: 48, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 10 },
  passwordInput: { fontFamily: "Inter_400Regular", flex: 1, minHeight: 46, padding: 0, fontSize: 15 },
  link: { fontFamily: "Inter_600SemiBold", fontSize: 13, lineHeight: 18 },
  error: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 19 },
  submit: { minHeight: 48, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  submitMuted: { opacity: 0.62 },
  submitText: { fontFamily: "Inter_700Bold", fontSize: 15 },
  footer: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 5 },
  footerText: { fontFamily: "Inter_400Regular", fontSize: 13 },
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.42)" },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 22, paddingTop: 12, gap: 12 },
  sheetHandle: { alignSelf: "center", width: 36, height: 4, borderRadius: 3, marginBottom: 8 },
  sheetHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 18, marginBottom: 8 },
  sheetHeading: { flex: 1, gap: 7 },
  sheetTitle: { fontFamily: "Inter_700Bold", fontSize: 21, lineHeight: 27, letterSpacing: -0.4 },
  sheetAction: { minHeight: 70, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  sheetActionCopy: { flex: 1, gap: 4 },
  sheetActionTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14, lineHeight: 19 },
  sheetActionDetail: { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 17 },
  sheetActionIcons: { flexDirection: "row", alignItems: "center", gap: 7 },
});
