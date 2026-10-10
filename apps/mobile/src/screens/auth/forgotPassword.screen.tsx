import { useState } from "react";

import { AuthStep } from "@/components/auth/authStep";
import { TextField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import { ApiError } from "@/errors/api.error";
import type { AuthScreenProps } from "@/navigation/navigation.types";
import { authService } from "@/services/auth/auth.service";
import { isValidEmailAddress } from "@/utils/validators.util";

export function ForgotPasswordScreen({ navigation }: AuthScreenProps<"ForgotPassword">) {
  const { colors } = useTheme();
  const [email, setEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const destination = isValidEmailAddress(email) ? email.trim().toLowerCase() : null;

  const sendPasswordResetCodeAndContinue = async () => {
    if (!destination) return;
    setErrorMessage(null);
    setSending(true);
    try {
      await authService.sendOneTimeCode(destination, "reset");
      navigation.navigate("VerifyOtp", { destination, purpose: "reset" });
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : "We couldn't send the code. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <AuthStep
      title="Forgot password?"
      subtitle="Enter the email on your account and we’ll send you a code to reset your password."
      actionTitle="Send Code"
      actionDisabled={!destination}
      loading={sending}
      onAction={sendPasswordResetCodeAndContinue}
    >
      <TextField
        label="Email"
        placeholder="Enter your email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        autoFocus
        invalid={!!errorMessage}
        returnKeyType="send"
        onSubmitEditing={sendPasswordResetCodeAndContinue}
      />
      {errorMessage ? (
        <Text size={12} weight={500} lineHeight={14.4} color={colors.error} accessibilityRole="alert">
          {errorMessage}
        </Text>
      ) : null}
    </AuthStep>
  );
}
