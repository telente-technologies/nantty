import { StyleSheet, View } from "react-native";

import { Check16Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme, type ThemeColors } from "@/theme";
import { calculatePasswordStrength, checkPasswordRequirements, type PasswordStrength } from "@/utils/validators.util";

const STRENGTH_BAR_WIDTH_FRACTION: Record<PasswordStrength, number> = { none: 0, weak: 61.7 / 361, medium: 188.3 / 361, strong: 1 };
const strengthBarColorFor = (colors: ThemeColors): Record<PasswordStrength, string> => ({
  none: colors.placeholder,
  weak: colors.error,
  medium: colors.caution,
  strong: colors.success,
});
const STRENGTH_LABEL: Record<PasswordStrength, string> = { none: "", weak: "Weak", medium: "Medium", strong: "Strong" };

export function PasswordRequirements({ password }: { password: string }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const requirements = checkPasswordRequirements(password);
  const strength = calculatePasswordStrength(password);
  return (
    <View style={styles.root}>
      <View style={styles.rules}>
        <Text size={13} weight={500} lineHeight={16.9}>
          Your password must have at least:
        </Text>
        <View style={styles.ruleList}>
          <PasswordRequirementRow met={requirements.hasLengthBetweenEightAndTwenty} label="8 characters (20 max)" />
          <PasswordRequirementRow met={requirements.hasLetterAndNumber} label="1 letter and 1 number" />
          <PasswordRequirementRow met={requirements.hasSpecialCharacter} label="1 special character (Example: # $ % ! @)" />
        </View>
      </View>
      <View style={styles.track} accessibilityRole="progressbar" accessibilityLabel={`Password strength ${STRENGTH_LABEL[strength] || "not set"}`}>
        <View
          style={[styles.fill, { width: `${STRENGTH_BAR_WIDTH_FRACTION[strength] * 100}%`, backgroundColor: strengthBarColorFor(colors)[strength] }]}
        />
      </View>
      <View style={styles.strengthRow}>
        <Text size={13} lineHeight={16.9}>
          Password strength:
        </Text>
        {strength !== "none" ? (
          <Text size={13} weight={500} lineHeight={16.9}>
            {STRENGTH_LABEL[strength]}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function PasswordRequirementRow({ met, label }: { met: boolean; label: string }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.rule} accessibilityLabel={`${label}${met ? ", met" : ", not met"}`}>
      <Check16Icon color={met ? colors.success : undefined} />
      <Text size={13} lineHeight={16.9} color={met ? colors.text : colors.textSubtle}>
        {label}
      </Text>
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  root: {},
  rules: { gap: 8 },
  ruleList: { gap: 4 },
  rule: { height: 17, flexDirection: "row", alignItems: "center", gap: 4 },
  track: { marginTop: 30, height: 4, borderRadius: 4, backgroundColor: colors.placeholder, overflow: "hidden" },
  fill: { height: 4, borderRadius: 4 },
  strengthRow: { marginTop: 16, flexDirection: "row", alignItems: "center", gap: 8 },
}));
