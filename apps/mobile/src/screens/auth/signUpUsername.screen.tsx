import { useState } from "react";
import { Pressable } from "react-native";

import { AuthStep } from "@/components/auth/authStep";
import { TextField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import { ApiError } from "@/errors/api.error";
import type { AuthScreenProps } from "@/navigation/navigation.types";
import { authService } from "@/services/auth.service";
import { useAuthStore } from "@/store/auth.store";
import { useSignUpStore } from "@/store/signup.store";
import { isValidUsername } from "@/utils/validators.util";

export function SignUpUsernameScreen({ navigation }: AuthScreenProps<"SignUpUsername">) {
  const draft = useSignUpStore();
  const replaceSessionTokens = useAuthStore((state) => state.replaceSessionTokens);
  const [username, setUsername] = useState(draft.username);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [creatingAccount, setCreatingAccount] = useState(false);

  const createAccountAndContinue = async (chosenUsername: string | undefined) => {
    if (!draft.otpToken) {
      setErrorMessage("Your verification expired. Go back and request a new code.");
      return;
    }
    setErrorMessage(null);
    setCreatingAccount(true);
    try {
      if (chosenUsername) {
        const { available } = await authService.checkIfUsernameIsAvailable(chosenUsername);
        if (!available) {
          setErrorMessage("That username is taken. Try another one.");
          return;
        }
      }
      const session = await authService.registerNewAccount({
        ...(draft.channel === "phone" ? { phone: draft.destination } : { email: draft.destination }),
        birthday: draft.birthday,
        password: draft.password,
        username: chosenUsername,
        otpToken: draft.otpToken,
      });
      await replaceSessionTokens(session);
      draft.updateSignUpDraft({ username: chosenUsername ?? "", password: "", pendingSession: session });
      navigation.navigate("Personalization");
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : "We couldn't create your account. Please try again.");
    } finally {
      setCreatingAccount(false);
    }
  };

  return (
    <AuthStep
      title="Create username"
      subtitle="This can be anything you like and can be changed later. If you skip this step, you will be automatically assigned a default name."
      actionTitle="Confirm"
      actionDisabled={!isValidUsername(username)}
      loading={creatingAccount}
      onAction={() => createAccountAndContinue(username)}
      right={
        <Pressable accessibilityRole="button" hitSlop={12} disabled={creatingAccount} onPress={() => createAccountAndContinue(undefined)}>
          <Text size={13} weight={500} lineHeight={16.9}>
            Skip
          </Text>
        </Pressable>
      }
    >
      <TextField
        placeholder="Username"
        value={username}
        onChangeText={(text) => setUsername(text.replace(/\s/g, ""))}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
        maxLength={20}
        textContentType="username"
        accessibilityLabel="Username"
        invalid={!!errorMessage}
        returnKeyType="done"
        onSubmitEditing={() => createAccountAndContinue(username)}
      />
      {errorMessage ? (
        <Text size={12} weight={500} lineHeight={14.4} color={colors.error} accessibilityRole="alert">
          {errorMessage}
        </Text>
      ) : (
        <Text size={12} lineHeight={16.8} color={colors.textSubtle}>
          3–20 characters. Letters, numbers, underscores and full stops only.
        </Text>
      )}
    </AuthStep>
  );
}
