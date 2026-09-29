import { useState } from "react";

import { AuthStep } from "@/components/auth/authStep";
import { TextField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import { ApiError } from "@/errors/api.error";
import type { AuthScreenProps } from "@/navigation/navigation.types";
import { authService } from "@/services/auth.service";
import {
  convertNigerianPhoneNumberToInternationalFormat,
  isValidEmailAddress,
  isValidNigerianPhoneNumber,
} from "@/utils/validators.util";

function convertEmailOrPhoneToCodeDestination(value: string): string | null {
  const trimmed = value.trim();
  if (isValidEmailAddress(trimmed)) return trimmed.toLowerCase();
  if (isValidNigerianPhoneNumber(trimmed)) return convertNigerianPhoneNumberToInternationalFormat(trimmed);
  return null;
}

export function ForgotPasswordScreen({ navigation }: AuthScreenProps<"ForgotPassword">) {
  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const destination = convertEmailOrPhoneToCodeDestination(emailOrPhone);

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
      subtitle="Enter the email or phone number on your account and we’ll send you a code to reset your password."
      actionTitle="Send Code"
      actionDisabled={!destination}
      loading={sending}
      onAction={sendPasswordResetCodeAndContinue}
    >
      <TextField
        label="Email or phone number"
        placeholder="Enter your email or phone number"
        value={emailOrPhone}
        onChangeText={setEmailOrPhone}
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
