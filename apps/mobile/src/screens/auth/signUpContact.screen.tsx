import { useState } from "react";

import { AuthStep } from "@/components/auth/authStep";
import { RoundCheckbox } from "@/components/auth/roundCheckbox";
import { TextField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import { ApiError } from "@/errors/api.error";
import type { AuthScreenProps } from "@/navigation/navigation.types";
import { authService } from "@/services/auth/auth.service";
import { useSignUpStore } from "@/store/signup.store";
import { isValidEmailAddress } from "@/utils/validators.util";

export function SignUpContactScreen({ navigation }: AuthScreenProps<"SignUpContact">) {
  const { colors } = useTheme();
  const { saveLoginInfo, updateSignUpDraft } = useSignUpStore();
  const [email, setEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const sendVerificationCodeAndContinue = async () => {
    const destination = email.trim().toLowerCase();
    setErrorMessage(null);
    setSending(true);
    try {
      await authService.sendOneTimeCode(destination, "signup");
      updateSignUpDraft({ destination, otpToken: null });
      navigation.navigate("VerifyOtp", { destination, purpose: "signup" });
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : "We couldn't send the code. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <AuthStep
      title="What’s your email?"
      subtitle="We’ll send you a 6-digit code to confirm it’s you."
      actionTitle="Send Code"
      actionDisabled={!isValidEmailAddress(email)}
      loading={sending}
      onAction={sendVerificationCodeAndContinue}
    >
      <TextField
        placeholder="Enter your email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        textContentType="emailAddress"
        autoComplete="email"
        autoCapitalize="none"
        accessibilityLabel="Email"
        invalid={!!errorMessage}
      />      <RoundCheckbox
        checked={saveLoginInfo}
        onToggle={() => updateSignUpDraft({ saveLoginInfo: !saveLoginInfo })}
        label="Save login info on your device to log in automatically next time."
      />
      {errorMessage ? (
        <Text size={12} weight={500} lineHeight={14.4} color={colors.error} accessibilityRole="alert">
          {errorMessage}
        </Text>
      ) : null}
    </AuthStep>
  );
}
