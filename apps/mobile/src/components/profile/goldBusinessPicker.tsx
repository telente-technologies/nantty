import { Pressable, StyleSheet, View } from "react-native";

import { Check16Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { GoldEligibleBusiness } from "@/types/goldForBusinesses.type";
import { describeGoldCoverage } from "@/utils/goldForBusinessesQuote.util";

export interface GoldBusinessPickerProps {
  readonly businesses: readonly GoldEligibleBusiness[];
  readonly selected: readonly string[];
  readonly onToggle: (profileId: string) => void;
  readonly disabled?: boolean;
}

export function GoldBusinessPicker({ businesses, selected, onToggle, disabled }: GoldBusinessPickerProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.list}>
      {businesses.map((business) => {
        const checked = selected.includes(business.profileId);
        const locked = disabled || business.hasOwnGold;
        const note = business.hasOwnGold ? "Already has its own Gold plan" : describeGoldCoverage(business.coverage);
        return (
          <Pressable
            key={business.profileId}
            accessibilityRole="checkbox"
            accessibilityState={{ checked, disabled: locked }}
            disabled={locked}
            onPress={() => onToggle(business.profileId)}
            style={[styles.row, checked ? styles.rowChecked : null, locked ? styles.rowLocked : null]}
          >
            <View style={[styles.box, checked ? styles.boxOn : null]}>{checked ? <Check16Icon size={12} color={colors.onPrimary} /> : null}</View>
            <View style={styles.texts}>
              <Text size={14} weight={500} lineHeight={18}>{business.displayName}</Text>
              <Text size={12} lineHeight={16} color={colors.textMuted}>{business.profileType === "brand" ? "Brand" : "Business"}{note ? ` · ${note}` : ""}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  list: { gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.divider },
  rowChecked: { borderColor: colors.primarySolid },
  rowLocked: { opacity: 0.5 },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.textMuted, alignItems: "center", justifyContent: "center" },
  boxOn: { borderColor: colors.primarySolid, backgroundColor: colors.primarySolid },
  texts: { flex: 1, gap: 2 },
}));
