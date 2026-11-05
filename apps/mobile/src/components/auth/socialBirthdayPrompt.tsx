import { useState } from "react";
import { StyleSheet, View } from "react-native";

import type { SocialSignInProvider } from "@/errors/socialSignIn.error";
import { MINIMUM_ACCOUNT_AGE_IN_YEARS, insertSlashesIntoBirthdayInput, isBirthdayValidForNewAccount, parseBirthdayFromDayMonthYear } from "@/utils/validators.util";
import { makeThemedStyles, useTheme } from "@/theme";

import { Button } from "../ui/button";
import { TextField } from "../ui/input";
import { Text } from "../ui/text";

interface SocialBirthdayPromptProps {
  readonly provider: SocialSignInProvider;
  readonly loading: boolean;
  readonly failureMessage: string | null;
  readonly onContinue: (birthday: string) => void;
  readonly onCancel: () => void;
}

export function SocialBirthdayPrompt({ provider, loading, failureMessage, onContinue, onCancel }: SocialBirthdayPromptProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [birthdayText, setBirthdayText] = useState("");
  const birthday = parseBirthdayFromDayMonthYear(birthdayText);
  const isValid = isBirthdayValidForNewAccount(birthdayText);
  const submit = () => {
    if (birthday && isValid) onContinue(birthday.toISOString().slice(0, 10));
  };

  return (
    <View style={styles.container}>
      <Text size={14} weight={500} lineHeight={19.6} accessibilityRole="header">
        Add your birthday to continue with {provider === "apple" ? "Apple" : "Google"}
      </Text>
      <Text size={12} lineHeight={17} color={colors.textSubtle}>
        Nantty requires your birthday to create an account. It won’t be shown publicly.
      </Text>
      <TextField
        label="Birthday"
        placeholder="dd/mm/yyyy"
        value={birthdayText}
        onChangeText={(text) => setBirthdayText(insertSlashesIntoBirthdayInput(text))}
        keyboardType="number-pad"
        maxLength={10}
        accessibilityLabel="Birthday, day month year"
        invalid={birthdayText.length === 10 && !isValid}
        returnKeyType="done"
        onSubmitEditing={submit}
      />
      {birthdayText.length === 10 && !isValid ? (
        <Text size={12} lineHeight={16} color={colors.error} accessibilityRole="alert">
          {birthday ? `You must be at least ${MINIMUM_ACCOUNT_AGE_IN_YEARS} years old to use Nantty.` : "Enter a real date, like 27/10/2000."}
        </Text>
      ) : null}
      {failureMessage ? (
        <Text size={12} lineHeight={16} color={colors.error} accessibilityRole="alert">
          {failureMessage}
        </Text>
      ) : null}
      <Button title="Continue" onPress={submit} disabled={!isValid} loading={loading} />
      <Button title="Cancel" variant="subtle" onPress={onCancel} disabled={loading} />
    </View>
  );
}

const useStyles = makeThemedStyles(() => StyleSheet.create({ container: { gap: 12, paddingVertical: 8 } }));
