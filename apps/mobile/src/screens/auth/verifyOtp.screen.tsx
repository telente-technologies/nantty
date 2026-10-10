import { useState } from "react";

import { AuthStep } from "@/components/auth/authStep";
import { OTP_CODE_LENGTH, OtpCodeInput } from "@/components/auth/otpCodeInput";
import { ResendCodeTimer } from "@/components/auth/resendCodeTimer";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import { ApiError } from "@/errors/api.error";
import type { AuthScreenProps } from "@/navigation/navigation.types";
import { authService } from "@/services/auth/auth.service";
import { useSignUpStore } from "@/store/signup.store";

const SECONDS_BEFORE_CODE_CAN_BE_RESENT = 60;

export function VerifyOtpScreen({ navigation, route }: AuthScreenProps<"VerifyOtp">) {
  const { colors } = useTheme();
  const { destination, purpose } = route.params;
  const updateSignUpDraft = useSignUpStore((state) => state.updateSignUpDraft);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [resendTimerRestartKey, setResendTimerRestartKey] = useState(0);

  const verifyCodeAndContinue = async (enteredCode = code) => {
    if (enteredCode.length !== OTP_CODE_LENGTH || verifying) return;
    setMessage(null);
    setVerifying(true);
    try {
      const { otpToken } = await authService.verifyOneTimeCode(destination, enteredCode, purpose);
      updateSignUpDraft({ otpToken, destination });
      if (purpose === "reset") navigation.navigate("ResetPassword", { identifier: destination });
      else navigation.navigate("SignUpBirthday");
    } catch (error) {
      setMessage({ text: error instanceof ApiError ? error.message : "That code didn't work. Try again.", isError: true });
      setCode("");
    } finally {
      setVerifying(false);
    }
  };

  const resendVerificationCode = async () => {
    setMessage(null);
    try {
      await authService.sendOneTimeCode(destination, purpose);
      setResendTimerRestartKey((key) => key + 1);
      setMessage({ text: "We sent you a new code.", isError: false });
    } catch {
      setMessage({ text: "We couldn't resend the code. Please try again.", isError: true });
    }
  };

  return (
    <AuthStep
      title="Enter 6-digit code"
      subtitle={`Your code was sent to ${destination}`}
      actionTitle="Next"
      actionDisabled={code.length !== OTP_CODE_LENGTH}
      loading={verifying}
      onAction={() => verifyCodeAndContinue()}
    >
      <OtpCodeInput value={code} onChangeValue={setCode} onCodeComplete={verifyCodeAndContinue} invalid={!!message?.isError} />
      <ResendCodeTimer
        secondsUntilResendAllowed={SECONDS_BEFORE_CODE_CAN_BE_RESENT}
        restartKey={resendTimerRestartKey}
        onPressResendCode={resendVerificationCode}
      />
      {message ? (
        <Text size={12} weight={500} lineHeight={14.4} color={message.isError ? colors.error : colors.success} accessibilityRole="alert">
          {message.text}
        </Text>
      ) : null}
    </AuthStep>
  );
}
