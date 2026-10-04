import { useEffect, useState } from "react";
import { Pressable } from "react-native";

import { AuthStep } from "@/components/auth/authStep";
import { UsernameSuggestionChips } from "@/components/auth/usernameSuggestionChips";
import { TextField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import { ApiError } from "@/errors/api.error";
import type { AuthScreenProps } from "@/navigation/navigation.types";
import { useUsernameAvailability } from "@/components/settings/usernameAvailability.hook";
import { authService } from "@/services/auth.service";
import { usersService } from "@/services/users.service";
import { useAuthStore } from "@/store/auth.store";
import { useSignUpStore } from "@/store/signup.store";
import { isValidUsername } from "@/utils/validators.util";

export function SignUpUsernameScreen({ navigation }: AuthScreenProps<"SignUpUsername">) {
  const { colors } = useTheme();
  const draft = useSignUpStore();
  const replaceSessionTokens = useAuthStore((state) => state.replaceSessionTokens);
  const [username, setUsername] = useState(draft.username);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [suggestedUsername, setSuggestedUsername] = useState<string | null>(null);
  const [conflictSuggestions, setConflictSuggestions] = useState<readonly string[]>([]);
  const { isAvailable, message: availabilityMessage, suggestions: liveSuggestions } = useUsernameAvailability(username);
  const suggestions = liveSuggestions.length > 0 ? liveSuggestions : conflictSuggestions;

  const chooseSuggestion = (suggestion: string) => {
    setErrorMessage(null);
    setConflictSuggestions([]);
    setUsername(suggestion);
  };

  useEffect(() => {
    if (draft.username) return;
    usersService
      .fetchSuggestedUsername(draft.destination || "zudo")
      .then(({ username: suggestion }) => {
        setSuggestedUsername(suggestion);
        setUsername((current) => current || suggestion);
      })
      .catch(() => undefined);
  }, []);

  const createAccountAndContinue = async (chosenUsername: string | undefined) => {
    if (!draft.otpToken) {
      setErrorMessage("Your verification expired. Go back and request a new code.");
      return;
    }
    setErrorMessage(null);
    setCreatingAccount(true);
    try {
      if (chosenUsername) {
        const { available, message: serverReason, suggestions: taken } = await authService.checkIfUsernameIsAvailable(chosenUsername);
        if (!available) {
          setConflictSuggestions(taken ?? []);
          setErrorMessage(serverReason ?? availabilityMessage ?? "That username isn't available. Try another one.");
          return;
        }
      }
      const session = await authService.registerNewAccount({
        email: draft.destination,
        birthday: draft.birthday,
        password: draft.password,
        username: chosenUsername,
        otpToken: draft.otpToken,
      });
      await replaceSessionTokens(session);
      draft.updateSignUpDraft({ username: chosenUsername ?? "", password: "", pendingSession: session });
      navigation.navigate("Personalization");
    } catch (error) {
      if (error instanceof ApiError && error.code === "USERNAME_TAKEN") setConflictSuggestions(error.suggestions ?? []);
      setErrorMessage(error instanceof ApiError ? error.message : "We couldn't create your account. Please try again.");
    } finally {
      setCreatingAccount(false);
    }
  };

  return (
    <AuthStep
      title="Create username"
      subtitle="We've suggested one for you. Keep it, change it, or skip — you'll keep the suggested username and can change it later in Settings."
      actionTitle="Confirm"
      actionDisabled={!isValidUsername(username) || !isAvailable}
      loading={creatingAccount}
      onAction={() => createAccountAndContinue(username)}
      right={
        <Pressable accessibilityRole="button" hitSlop={12} disabled={creatingAccount} onPress={() => createAccountAndContinue(suggestedUsername ?? undefined)}>
          <Text size={13} weight={500} lineHeight={16.9}>
            Skip
          </Text>
        </Pressable>
      }
    >
      <TextField
        placeholder="Username"
        value={username}
        onChangeText={(text) => {
          setConflictSuggestions([]);
          setUsername(text.replace(/\s/g, ""));
        }}
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
        <Text size={12} lineHeight={16.8} color={isAvailable ? colors.success : colors.textSubtle} accessibilityLiveRegion="polite">
          {availabilityMessage ?? "3–20 characters. Letters, numbers, underscores and full stops only."}
        </Text>
      )}
      <UsernameSuggestionChips suggestions={suggestions} onSelect={chooseSuggestion} />
    </AuthStep>
  );
}
