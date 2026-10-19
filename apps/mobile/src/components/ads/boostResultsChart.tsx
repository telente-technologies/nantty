import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { Chip } from "@/components/ui/chip";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { BoostReportPoint } from "@/types/boost.type";
import { reportBars, type ReportBarMetric } from "@/utils/adsHub.util";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

const CHART_HEIGHT = 96;
const METRICS: readonly { readonly key: ReportBarMetric; readonly label: string }[] = [
  { key: "impressions", label: "Impressions" },
  { key: "clicks", label: "Taps" },
  { key: "results", label: "Results" },
  { key: "spend", label: "Spend" },
];

const shortDate = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });

export function BoostResultsChart({ series }: { readonly series: readonly BoostReportPoint[] }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [metric, setMetric] = useState<ReportBarMetric>("impressions");
  if (series.length === 0) return <Text size={12} lineHeight={16} color={colors.textMuted}>Daily results appear here once your ad starts running.</Text>;
  const bars = reportBars(series, metric);
  const describe = (index: number) => (metric === "spend" ? formatMoneyForDisplay(series[index]!.spend) : bars[index]!.value.toLocaleString());
  return (
    <View style={styles.root}>
      <View style={styles.chips}>
        {METRICS.map((option) => <Chip key={option.key} label={option.label} selected={metric === option.key} onPress={() => setMetric(option.key)} />)}
      </View>
      <View style={styles.chart} accessible accessibilityLabel={`Daily ${METRICS.find((option) => option.key === metric)?.label.toLowerCase()}: ${bars.map((bar, index) => `${shortDate(bar.date)} ${describe(index)}`).join(", ")}`}>
        {bars.map((bar) => (
          <View key={bar.date} style={styles.column}>
            <View style={[styles.bar, { height: Math.max(2, Math.round(bar.ratio * CHART_HEIGHT)) }]} />
          </View>
        ))}
      </View>
      <View style={styles.axis} importantForAccessibility="no-hide-descendants">
        <Text size={11} lineHeight={14} color={colors.textMuted}>{shortDate(bars[0]!.date)}</Text>
        {bars.length > 1 ? <Text size={11} lineHeight={14} color={colors.textMuted}>{shortDate(bars[bars.length - 1]!.date)}</Text> : null}
      </View>
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  root: { gap: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chart: { height: CHART_HEIGHT, flexDirection: "row", alignItems: "flex-end", gap: 3 },
  column: { flex: 1, justifyContent: "flex-end" },
  bar: { backgroundColor: colors.primary, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  axis: { flexDirection: "row", justifyContent: "space-between" },
}));
