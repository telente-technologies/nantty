import { useState } from "react";

import { AuthStep } from "@/components/auth/authStep";
import { PasswordRequirements } from "@/components/auth/passwordRequirements";
import { TextField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import { ApiError } from "@/errors/api.error";
import type { AuthScreenProps } from "@/navigation/navigation.types";
import { authService } from "@/services/auth/auth.service";
import { useSignUpStore } from "@/store/signup.store";
import { isPasswordStrongEnoughForAccount } from "@/utils/validators.util";

export function ResetPasswordScreen({ navigation }: AuthScreenProps<"ResetPassword">) {
  const { colors } = useTheme();
  const otpToken = useSignUpStore((state) => state.otpToken);
  const clearSignUpDraft = useSignUpStore((state) => state.clearSignUpDraft);
  const [newPassword, setNewPassword] = useState("");
  const [confirmedPassword, setConfirmedPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const passwordsMatch = confirmedPassword.length > 0 && newPassword === confirmedPassword;
  const canSave = isPasswordStrongEnoughForAccount(newPassword) && passwordsMatch;

  const saveNewPasswordAndReturnToLogin = async () => {
    if (!canSave) return;
    if (!otpToken) {
      setErrorMessage("Your reset code expired. Request a new one.");
      return;
    }
    setErrorMessage(null);
    setSaving(true);
    try {
      await authService.resetPasswordWithVerifiedCode(otpToken, newPassword);
      clearSignUpDraft();
      navigation.reset({ index: 1, routes: [{ name: "Onboarding", params: { mode: "login" } }, { name: "Login" }] });
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : "We couldn't reset your password. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuthStep
      title="Create new password"
      subtitle="Your new password must be different from the one you used before."
      actionTitle="Save password"
      actionDisabled={!canSave}
      loading={saving}
      onAction={saveNewPasswordAndReturnToLogin}
    >
      <TextField
        label="New password"
        placeholder="Enter password"
        value={newPassword}
        onChangeText={setNewPassword}
        password
        autoFocus
        maxLength={20}
        textContentType="newPassword"
        autoComplete="new-password"
      />
      <TextField
        label="Confirm password"
        placeholder="Enter password again"
        value={confirmedPassword}
        onChangeText={setConfirmedPassword}
        password
        maxLength={20}
        textContentType="newPassword"
        invalid={confirmedPassword.length > 0 && !passwordsMatch}
        returnKeyType="done"
        onSubmitEditing={saveNewPasswordAndReturnToLogin}
      />
      {confirmedPassword.length > 0 && !passwordsMatch ? (
        <Text size={12} weight={500} lineHeight={14.4} color={colors.error}>
          Passwords don’t match.
        </Text>
      ) : null}
      <PasswordRequirements password={newPassword} />
      {errorMessage ? (
        <Text size={12} weight={500} lineHeight={14.4} color={colors.error} accessibilityRole="alert">
          {errorMessage}
        </Text>
      ) : null}
    </AuthStep>
  );
}
