import { useState } from "react";
import { StyleSheet } from "react-native";

import { AuthStep } from "@/components/auth/authStep";
import { TextField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import type { AuthScreenProps } from "@/navigation/navigation.types";
import { useSignUpStore } from "@/store/signup.store";
import {
  MINIMUM_ACCOUNT_AGE_IN_YEARS,
  insertSlashesIntoBirthdayInput,
  isBirthdayValidForNewAccount,
  parseBirthdayFromDayMonthYear,
} from "@/utils/validators.util";

export function SignUpBirthdayScreen({ navigation }: AuthScreenProps<"SignUpBirthday">) {
  const { colors } = useTheme();
  const updateSignUpDraft = useSignUpStore((state) => state.updateSignUpDraft);
  const [birthdayText, setBirthdayText] = useState("");
  const isComplete = birthdayText.length === 10;
  const isValid = isBirthdayValidForNewAccount(birthdayText);

  const saveBirthdayAndContinue = () => {
    const birthday = parseBirthdayFromDayMonthYear(birthdayText);
    if (!birthday || !isValid) return;
    updateSignUpDraft({ birthday: birthday.toISOString().slice(0, 10) });
    navigation.navigate("SignUpPassword");
  };

  return (
    <AuthStep
      title="When’s your birthday?"
      subtitle="Your birthday won’t be shown publicly."
      actionTitle="Next"
      actionDisabled={!isValid}
      onAction={saveBirthdayAndContinue}
      contentGap={30}
    >
      <TextField
        placeholder="dd/mm/yyyy"
        value={birthdayText}
        onChangeText={(text) => setBirthdayText(insertSlashesIntoBirthdayInput(text))}
        keyboardType="number-pad"
        maxLength={10}
        autoFocus
        accessibilityLabel="Birthday, day month year"
        invalid={isComplete && !isValid}
        returnKeyType="next"
        onSubmitEditing={saveBirthdayAndContinue}
      />
      {isComplete && !isValid ? (
        <Text size={12} weight={500} lineHeight={14.4} color={colors.error} style={styles.error} accessibilityRole="alert">
          {parseBirthdayFromDayMonthYear(birthdayText)
            ? `You must be at least ${MINIMUM_ACCOUNT_AGE_IN_YEARS} years old to use Nantty.`
            : "Enter a real date, like 27/10/2000."}
        </Text>
      ) : null}
    </AuthStep>
  );
}

const styles = StyleSheet.create({ error: { marginTop: -18 } });
