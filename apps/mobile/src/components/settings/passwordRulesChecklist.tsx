import { StyleSheet, View } from "react-native";

import { Check16Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";

export const PASSWORD_RULES = [
  { label: "8 characters (20 max)", isSatisfiedBy: (password: string) => password.length >= 8 && password.length <= 20 },
  { label: "1 letter and 1 number", isSatisfiedBy: (password: string) => /[A-Za-z]/.test(password) && /\d/.test(password) },
  { label: "1 special character (Example: # $ % ! @)", isSatisfiedBy: (password: string) => /[^A-Za-z0-9]/.test(password) },
] as const;

export const passwordMeetsEveryRule = (password: string) => PASSWORD_RULES.every((rule) => rule.isSatisfiedBy(password));

const STRENGTH_LEVELS = [
  { label: "", color: colors.divider, fraction: 0 },
  { label: "Weak", color: colors.error, fraction: 0.17 },
  { label: "Medium", color: colors.caution, fraction: 0.52 },
  { label: "Strong", color: colors.success, fraction: 1 },
] as const;

export function PasswordRulesChecklist({ password }: { password: string }) {
  const satisfiedCount = password ? PASSWORD_RULES.filter((rule) => rule.isSatisfiedBy(password)).length : 0;
  const strength = STRENGTH_LEVELS[satisfiedCount]!;
  return (
    <View style={styles.root}>
      <View style={styles.rules}>
        <Text size={13} weight={500} lineHeight={16.9}>
          Your password must have at least:
        </Text>
        {PASSWORD_RULES.map((rule) => {
          const satisfied = rule.isSatisfiedBy(password);
          return (
            <View key={rule.label} style={styles.rule} accessibilityLabel={`${rule.label}, ${satisfied ? "done" : "not yet"}`}>
              <Check16Icon color={satisfied ? colors.success : undefined} />
              <Text size={13} lineHeight={16.9} color={satisfied ? colors.text : colors.textSubtle}>
                {rule.label}
              </Text>
            </View>
          );
        })}
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${strength.fraction * 100}%`, backgroundColor: strength.color }]} />
      </View>
      <View style={styles.strength}>
        <Text size={13} lineHeight={16.9}>
          Password strength:
        </Text>
        <Text size={13} weight={500} lineHeight={16.9}>
          {strength.label}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 16 },
  rules: { gap: 4 },
  rule: { flexDirection: "row", alignItems: "center", gap: 4 },
  track: { height: 4, borderRadius: 4, backgroundColor: colors.divider, overflow: "hidden", marginTop: 14 },
  fill: { height: 4, borderRadius: 4 },
  strength: { flexDirection: "row", alignItems: "center", gap: 8 },
});
