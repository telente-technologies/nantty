import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import type { SellerDashboardPeriod } from "@/types/account.type";

const PERIODS: { key: SellerDashboardPeriod; label: string }[] = [
  { key: "live", label: "Live" },
  { key: "yesterday", label: "Yesterday" },
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "all", label: "All time" },
];

export function PeriodChips({ value, onChange }: { value: SellerDashboardPeriod; onChange: (period: SellerDashboardPeriod) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bar} contentContainerStyle={styles.row}>
      {PERIODS.map((period) => {
        const selected = period.key === value;
        return (
          <Pressable
            key={period.key}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(period.key)}
            style={[styles.chip, { backgroundColor: selected ? colors.primaryTint : colors.white }]}
          >
            {period.key === "live" ? <View style={styles.liveDot} /> : null}
            <Text size={13} weight={500} lineHeight={16.9} color={selected ? colors.primary : colors.textMuted}>
              {period.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bar: { flexGrow: 0, flexShrink: 0 },
  row: { paddingLeft: 16, paddingRight: 16, paddingVertical: 12, gap: 17 },
  chip: { height: 25, paddingHorizontal: 4, borderRadius: 4, flexDirection: "row", alignItems: "center", gap: 4 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.error },
});
