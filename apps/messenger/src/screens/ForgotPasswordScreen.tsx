import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { ArrowLeftIcon } from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ApiError, requestJson } from "../api/apiClient";
import { useMessengerColors } from "../ui/useMessengerColors";
import { BrandLockup } from "../ui/BrandLockup";

type RecoveryStep = "email" | "code" | "password" | "complete";
const OTP_LENGTH = 6;

export function ForgotPasswordScreen({ onBack }: { readonly onBack: () => void }) {
  const colors = useMessengerColors();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<RecoveryStep>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [otpToken, setOtpToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      if (step === "email") {
        await requestJson("/api/v1/auth/otp/send", { method: "POST", body: { destination: email.trim().toLowerCase(), purpose: "reset" } });
        setStep("code");
        setMessage({ text: "If that email belongs to a Nantty account, we’ve sent a reset code.", error: false });
      } else if (step === "code") {
        const result = await requestJson<{ otpToken: string }>("/api/v1/auth/otp/verify", {
          method: "POST",
          body: { destination: email.trim().toLowerCase(), code: code.trim(), purpose: "reset" },
        });
        if (!result.otpToken) throw new ApiError("That code could not be verified. Request another code.", 400, "INVALID_CODE");
        setOtpToken(result.otpToken);
        setStep("password");
      } else if (step === "password") {
        if (!otpToken) throw new ApiError("Your reset code has expired. Request a new one.", 401, "OTP_EXPIRED");
        await requestJson<void>("/api/v1/auth/password/reset", { method: "POST", body: { otpToken, password } });
        setStep("complete");
      }
    } catch (error) {
      setMessage({ text: error instanceof ApiError ? error.message : "We couldn’t complete account recovery. Please try again.", error: true });
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await requestJson("/api/v1/auth/otp/send", { method: "POST", body: { destination: email.trim().toLowerCase(), purpose: "reset" } });
      setCode("");
      setMessage({ text: "If that email belongs to a Nantty account, we’ve sent a new code.", error: false });
    } catch (error) {
      setMessage({ text: error instanceof ApiError ? error.message : "We couldn’t send a new code. Try again shortly.", error: true });
    } finally { setBusy(false); }
  };

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const validPassword = password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);
  const canContinue = step === "email" ? validEmail : step === "code" ? /^\d{6}$/.test(code.trim()) : step === "password" ? validPassword && confirmation === password : false;

  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: colors.background }]} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: Math.max(insets.top, 20) + 12, paddingBottom: Math.max(insets.bottom, 20) + 16 }]} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          <Pressable accessibilityLabel="Back to sign in" accessibilityRole="button" hitSlop={12} onPress={step === "email" || step === "complete" ? onBack : () => setStep(step === "password" ? "code" : "email")} style={styles.back}>
            <ArrowLeftIcon size={21} color={colors.text} />
          </Pressable>
          <BrandLockup />
          <View style={styles.heading}>
            <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{step === "complete" ? "Password updated" : "Recover your account"}</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>{subtitleFor(step)}</Text>
          </View>

          {step === "email" ? <TextInput accessibilityLabel="Account email" autoCapitalize="none" autoComplete="email" autoCorrect={false} keyboardType="email-address" onChangeText={setEmail} placeholder="Email on your Nantty account" placeholderTextColor={colors.subtle} style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} value={email} /> : null}
          {step === "code" ? (
            <>
              <TextInput accessibilityLabel="Six-digit reset code" autoComplete="one-time-code" keyboardType="number-pad" maxLength={OTP_LENGTH} onChangeText={(value) => setCode(value.replace(/\D/g, ""))} placeholder="6-digit code" placeholderTextColor={colors.subtle} style={[styles.input, styles.codeInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} value={code} />
              <Pressable accessibilityRole="button" disabled={busy} onPress={() => void resend()}><Text style={[styles.link, { color: colors.brand }]}>Resend code</Text></Pressable>
            </>
          ) : null}
          {step === "password" ? (
            <View style={styles.passwordFields}>
              <TextInput accessibilityLabel="New password" autoComplete="new-password" onChangeText={setPassword} placeholder="New password" placeholderTextColor={colors.subtle} secureTextEntry style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} value={password} />
              <TextInput accessibilityLabel="Confirm new password" autoComplete="new-password" onChangeText={setConfirmation} placeholder="Confirm new password" placeholderTextColor={colors.subtle} secureTextEntry style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} value={confirmation} />
              <Text style={[styles.hint, { color: colors.muted }]}>Use at least 8 characters, including a letter and a number.</Text>
            </View>
          ) : null}
          {step === "complete" ? <Text style={[styles.subtitle, { color: colors.muted }]}>You can now sign in to Messenger with your new password.</Text> : null}

          {message ? <Text accessibilityRole="alert" style={[styles.message, { color: message.error ? colors.danger : colors.brand }]}>{message.text}</Text> : null}
          {step === "complete" ? (
            <Pressable accessibilityRole="button" onPress={onBack} style={[styles.button, { backgroundColor: colors.brand }]}><Text style={[styles.buttonText, { color: colors.onBrand }]}>Back to sign in</Text></Pressable>
          ) : (
            <Pressable accessibilityRole="button" accessibilityState={{ disabled: !canContinue, busy }} disabled={!canContinue || busy} onPress={() => void submit()} style={({ pressed }) => [styles.button, { backgroundColor: colors.brand }, (!canContinue || pressed) && styles.disabled]}>
              {busy ? <ActivityIndicator color={colors.onBrand} /> : <Text style={[styles.buttonText, { color: colors.onBrand }]}>{step === "email" ? "Send reset code" : step === "code" ? "Verify code" : "Save new password"}</Text>}
            </Pressable>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function subtitleFor(step: RecoveryStep): string {
  if (step === "email") return "Enter the email on your Nantty account. We’ll send a one-time code if it matches.";
  if (step === "code") return "Enter the six-digit code sent to your email.";
  if (step === "password") return "Choose a new password for your Nantty account.";
  return "Your password has been changed securely.";
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 24 },
  content: { width: "100%", maxWidth: 440, gap: 22 },
  back: { alignSelf: "flex-start", padding: 4 },
  heading: { gap: 8, marginTop: 8 },
  title: { fontFamily: "Inter_700Bold", fontSize: 25, lineHeight: 32, fontWeight: "700", letterSpacing: -0.6 },
  subtitle: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21 },
  input: { fontFamily: "Inter_400Regular", minHeight: 48, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 14, fontSize: 15 },
  codeInput: { fontFamily: "Inter_600SemiBold", letterSpacing: 8, fontSize: 18, textAlign: "center" },
  passwordFields: { gap: 12 },
  hint: { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 17 },
  link: { fontFamily: "Inter_600SemiBold", fontSize: 13, lineHeight: 18, fontWeight: "600" },
  message: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 19 },
  button: { minHeight: 48, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  disabled: { opacity: 0.62 },
  buttonText: { fontFamily: "Inter_700Bold", fontSize: 15, fontWeight: "700" },
});
