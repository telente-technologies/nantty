import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { SelectableRow } from "@/components/cart/selectableRow";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { spacing } from "@/constants/spacing.constant";
import { typeScale } from "@/constants/typography.constant";
import { ApiError } from "@/errors/api.error";
import { usersService } from "@/services/account/users.service";
import { useTheme } from "@/theme";
import { countryChoices, countryRequiredCode, isCountryRequiredCode, resolveCountryChoice } from "@/utils/countryRequired.util";

export { countryRequiredCode };

export const countryRequiredTitle = "Where do you live?";
export const countryRequiredNote = "We charge you in your country's currency. You only tell us once; you can change it later in settings.";

export function isCountryRequiredError(error: unknown): boolean {
  return error instanceof ApiError && isCountryRequiredCode(error.code);
}

export function CountryRequiredPicker({ onSaved, showHeading = true }: { readonly onSaved: (countryCode: string) => void; readonly showHeading?: boolean }) {
  const { colors } = useTheme();
  const [choice, setChoice] = useState<string>("NG");
  const [otherCode, setOtherCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const countryCode = resolveCountryChoice(choice, otherCode);
  const valid = countryCode !== null;

  async function save() {
    if (countryCode === null) return;
    setSaving(true);
    setFailed(false);
    try {
      await usersService.updateMyCountryPreference(countryCode);
      onSaved(countryCode);
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      {showHeading ? (
        <>
          <Text size={typeScale.md} weight={600} lineHeight={16.8} accessibilityRole="header">{countryRequiredTitle}</Text>
          <Text size={typeScale.sm} lineHeight={16.9} color={colors.textMuted}>{countryRequiredNote}</Text>
        </>
      ) : null}
      {countryChoices.map((option) => (
        <SelectableRow key={option.code} selected={choice === option.code} onPress={() => setChoice(option.code)} accessibilityLabel={option.label}>
          <Text size={typeScale.md} weight={500} lineHeight={16.8}>{option.label}</Text>
        </SelectableRow>
      ))}
      {choice === "other" ? (
        <TextField label="Two-letter country code, like US or GB" value={otherCode} maxLength={2} autoCapitalize="characters" autoCorrect={false} onChangeText={setOtherCode} invalid={otherCode.length === 2 && !valid} />
      ) : null}
      {failed ? (
        <Text size={typeScale.xs} lineHeight={14.4} color={colors.error} accessibilityRole="alert">Couldn't save your country. Try again.</Text>
      ) : null}
      <Button title="Save and continue" disabled={!valid} loading={saving} onPress={save} />
    </View>
  );
}

const styles = StyleSheet.create({ container: { gap: spacing[3] } });
