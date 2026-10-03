import { StyleSheet, View } from "react-native";

import { SelectableRow } from "@/components/cart/selectableRow";
import { Chip } from "@/components/ui/chip";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { BoostAudience } from "@/types/boost.type";

const POPULAR_STATES = ["Lagos", "FCT Abuja", "Rivers", "Oyo", "Kano", "Enugu", "Anambra", "Delta"] as const;
const AGE_RANGES: readonly (readonly [number, number])[] = [[18, 24], [25, 34], [35, 44], [45, 65]];

export interface BoostAudiencePickerProps {
  readonly audience: BoostAudience;
  readonly interestOptions: readonly string[];
  readonly countryCode: string;
  readonly onChange: (audience: BoostAudience) => void;
}

const toggleValue = <T,>(values: readonly T[], value: T): T[] => (values.includes(value) ? values.filter((v) => v !== value) : [...values, value]);

export function BoostAudiencePicker({ audience, interestOptions, countryCode, onChange }: BoostAudiencePickerProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const custom = audience.mode === "custom" ? audience : { mode: "custom" as const, countryCode, states: [], interests: [], ageMin: 18, ageMax: 65 };
  return (
    <View style={styles.root}>
      <SelectableRow selected={audience.mode === "automatic"} onPress={() => onChange({ mode: "automatic" })} accessibilityLabel="Automatic audience">
        <Text size={14} weight={500} lineHeight={16.8}>Automatic</Text>
        <Text size={12} lineHeight={16.8} color={colors.textMuted}>We show it to people likely to be interested, like your followers' friends.</Text>
      </SelectableRow>
      <SelectableRow selected={audience.mode === "custom"} onPress={() => onChange(custom)} accessibilityLabel="Choose your audience">
        <Text size={14} weight={500} lineHeight={16.8}>Choose my audience</Text>
        <Text size={12} lineHeight={16.8} color={colors.textMuted}>Pick states, interests and age range.</Text>
      </SelectableRow>
      {audience.mode === "custom" ? (
        <View style={styles.custom}>
          <Text size={13} weight={500} lineHeight={16.9}>{countryCode === "NG" ? "States" : "Whole country"}</Text>
          <View style={styles.chips}>
            {(countryCode === "NG" ? POPULAR_STATES : ([] as const)).map((state) => (
              <Chip key={state} kind="topic" label={state} selected={audience.states.includes(state)} onPress={() => onChange({ ...audience, states: toggleValue(audience.states, state) })} />
            ))}
          </View>
          <Text size={13} weight={500} lineHeight={16.9}>Interests</Text>
          <View style={styles.chips}>
            {interestOptions.map((interest) => (
              <Chip key={interest} kind="topic" label={interest} selected={audience.interests.includes(interest)} onPress={() => onChange({ ...audience, interests: toggleValue(audience.interests, interest) })} />
            ))}
          </View>
          <Text size={13} weight={500} lineHeight={16.9}>Age</Text>
          <View style={styles.chips}>
            {AGE_RANGES.map(([ageMin, ageMax]) => (
              <Chip key={ageMin} kind="topic" label={`${ageMin}–${ageMax}`} selected={audience.ageMin === ageMin && audience.ageMax === ageMax} onPress={() => onChange({ ...audience, ageMin, ageMax })} />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  root: { gap: 8 },
  custom: { backgroundColor: colors.surface, borderRadius: 12, padding: 12, gap: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
}));
