import { StyleSheet, useWindowDimensions, View } from "react-native";
import Svg, { Line, Path } from "react-native-svg";

import { Text } from "@/components/ui/text";
import { palette } from "@/constants/colors.constant";
import { makeThemedStyles, useTheme } from "@/theme";
import type { Money } from "@/types";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

const CHART_WIDTH = 369;
const CHART_HEIGHT = 188;
const PLOT_LEFT = 66;
const PLOT_WIDTH = CHART_WIDTH - PLOT_LEFT - 10;
const BASELINE_Y = 170;
const PLOT_TOP = 14;
const PLOT_HEIGHT = BASELINE_Y - PLOT_TOP;

const roundedTopBarPath = (x: number, width: number, height: number) => {
  const top = BASELINE_Y - height;
  const r = Math.min(4, height);
  return `M${x} ${BASELINE_Y}V${top + r}Q${x} ${top} ${x + r} ${top}H${x + width - r}Q${x + width} ${top} ${x + width} ${top + r}V${BASELINE_Y}Z`;
};

interface SalesChartProps {
  readonly series: readonly { readonly label: string; readonly value: number }[];
  readonly totalSales: Money;
}

export function SalesChart({ series, totalSales }: SalesChartProps) {
  const { colors } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const styles = useStyles();
  const chartWidth = Math.min(CHART_WIDTH, Math.max(280, windowWidth - 32));
  const values = series.map(({ value }) => Number.isFinite(value) ? Math.max(0, value) : 0);
  const maximum = Math.max(0, ...values);
  const bucketWidth = PLOT_WIDTH / Math.max(series.length, 1);
  const tickValues = Array.from({ length: 5 }, (_, index) => maximum ? Math.round(maximum * (4 - index) / 4) : 0);
  const barWidth = Math.max(3, Math.min(20, bucketWidth * 0.62));
  const labelIndexes = [...new Set([0, Math.round((series.length - 1) / 3), Math.round((series.length - 1) * 2 / 3), series.length - 1])]
    .filter((index) => index >= 0 && index < series.length);
  return (
    <View style={[styles.card, { width: chartWidth }]} accessibilityLabel={`Sales chart for ${series.length} time periods in ${totalSales.currency}. Total sales ${formatMoneyForDisplay(totalSales)}`}>
      <Svg width="100%" height={CHART_HEIGHT} viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
        {Array.from({ length: 6 }, (_, i) => (
          <Line key={`v${i}`} x1={PLOT_LEFT + i * (PLOT_WIDTH / 5)} y1={0} x2={PLOT_LEFT + i * (PLOT_WIDTH / 5)} y2={169} stroke={colors.skeleton} strokeWidth={1} />
        ))}
        {[14, 54, 94, 134].map((y) => (
          <Line key={`h${y}`} x1={PLOT_LEFT} y1={y} x2={CHART_WIDTH} y2={y} stroke={colors.skeleton} strokeWidth={1} />
        ))}
        {values.map((value, i) =>
          value > 0 ? (
            <Path
              key={`b${i}`}
              d={roundedTopBarPath(PLOT_LEFT + i * bucketWidth + (bucketWidth - barWidth) / 2, barWidth, maximum ? Math.max(4, value / maximum * PLOT_HEIGHT) : 0)}
              fill={colors.primary}
            />
          ) : null,
        )}
        <Line x1={PLOT_LEFT} y1={BASELINE_Y + 1} x2={CHART_WIDTH} y2={BASELINE_Y + 1} stroke={palette.primary[400]} strokeWidth={2} strokeDasharray="6 4" />
      </Svg>
      <View style={styles.yAxis}>
        {tickValues.map((value, index) => (
          <Text key={`${value}-${index}`} numberOfLines={1} size={10} weight={500} lineHeight={12} color={colors.textSubtle} align="right">
            {formatMoneyForDisplay({ amountMinor: value, currency: totalSales.currency }, { showDecimals: false })}
          </Text>
        ))}
      </View>
      <View style={styles.xAxis}>
        {labelIndexes.map((index) => (
          <Text key={`${series[index]?.label}-${index}`} numberOfLines={1} size={10} weight={500} lineHeight={12} color={colors.textSubtle}>
            {series[index]?.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  card: { height: CHART_HEIGHT, alignSelf: "center", backgroundColor: colors.surface, borderRadius: 12, overflow: "hidden" },
  yAxis: { position: "absolute", left: 4, top: 5, width: PLOT_LEFT - 10, height: BASELINE_Y - 5, justifyContent: "space-between" },
  xAxis: { position: "absolute", left: PLOT_LEFT, right: 8, top: 172, flexDirection: "row", justifyContent: "space-between", gap: 4 },
}));
