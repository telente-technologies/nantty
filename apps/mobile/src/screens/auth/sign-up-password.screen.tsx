import { useState } from "react";

import { AuthStep } from "@/components/auth/auth-step";
import { PasswordRequirements } from "@/components/auth/passwordRequirements";
import { TextField } from "@/components/ui/input";
import type { AuthScreenProps } from "@/navigation/navigation.types";
import { useSignUpStore } from "@/store/signup.store";
import { isPasswordStrongEnoughForAccount } from "@/utils/validators.util";

export function SignUpPasswordScreen({ navigation }: AuthScreenProps<"SignUpPassword">) {
  const updateSignUpDraft = useSignUpStore((state) => state.updateSignUpDraft);
  const [password, setPassword] = useState("");
  const canContinue = isPasswordStrongEnoughForAccount(password);

  const savePasswordAndContinue = () => {
    if (!canContinue) return;
    updateSignUpDraft({ password });
    navigation.navigate("SignUpUsername");
  };

  return (
    <AuthStep
      title="Create password"
      subtitle="Choose a strong password to protect your account."
      actionTitle="Next"
      actionDisabled={!canContinue}
      onAction={savePasswordAndContinue}
    >
      <TextField
        placeholder="Enter password"
        value={password}
        onChangeText={setPassword}
        password
        autoFocus
        maxLength={20}
        textContentType="newPassword"
        autoComplete="new-password"
        accessibilityLabel="Password"
        returnKeyType="next"
        onSubmitEditing={savePasswordAndContinue}
      />
      <PasswordRequirements password={password} />
    </AuthStep>
  );
}
