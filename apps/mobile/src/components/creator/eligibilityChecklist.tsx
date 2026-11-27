import { StyleSheet, View } from "react-native";

import { Check16Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { CreatorEligibilityRequirement } from "@/types/creator.type";

const describeProgress = (requirement: CreatorEligibilityRequirement) => {
  if (!requirement.available) return "Data unavailable";
  if (requirement.requiredValue <= 1) return requirement.met ? "Done" : "Not yet";
  return requirement.met ? `${requirement.currentValue.toLocaleString()} / ${requirement.requiredValue.toLocaleString()}` : `${requirement.currentValue.toLocaleString()} / ${requirement.requiredValue.toLocaleString()} · ${requirement.remaining.toLocaleString()} to go`;
};

export function EligibilityChecklist({ requirements }: { requirements: readonly CreatorEligibilityRequirement[] }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.list}>
      {requirements.map((requirement) => {
        const progress = Math.min(1, requirement.currentValue / Math.max(requirement.requiredValue, 1));
        return (
            <View key={requirement.key} style={styles.item} accessibilityLabel={`${requirement.label}: ${describeProgress(requirement)}${requirement.dataAsOf ? `, data as of ${requirement.dataAsOf}` : ""}`}>
            <View style={styles.row}>
              <View style={[styles.check, requirement.met && styles.checkMet]}>{requirement.met ? <Check16Icon size={12} color={colors.white} /> : null}</View>
              <Text size={14} lineHeight={16.8} style={styles.label}>{requirement.label}</Text>
              <Text size={12} weight={500} lineHeight={14.4} color={requirement.met ? colors.success : colors.textMuted}>{describeProgress(requirement)}</Text>
            </View>
            {requirement.requiredValue > 1 ? (
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: requirement.met ? colors.success : colors.primary }]} />
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  list: { gap: 14 },
  item: { gap: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  check: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: colors.divider, alignItems: "center", justifyContent: "center" },
  checkMet: { backgroundColor: colors.success, borderColor: colors.success },
  label: { flex: 1 },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.primaryTint, marginLeft: 30, overflow: "hidden" },
  fill: { height: 4, borderRadius: 2 },
}));
