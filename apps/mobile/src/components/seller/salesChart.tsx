import { StyleSheet, View } from "react-native";
import Svg, { Line, Path } from "react-native-svg";

import { Text } from "@/components/ui/text";
import { colors, palette } from "@/constants/colors.constant";

const CHART_WIDTH = 369;
const CHART_HEIGHT = 188;
const PLOT_LEFT = 33;
const PLOT_WIDTH = 300;
const BASELINE_Y = 170;
const PIXELS_PER_UNIT = 13;
const Y_AXIS_LABELS = ["12", "9", "6", "3", "0"];
const X_AXIS_LABELS = ["12 AM", "3 PM", "6 PM", "9 PM", "12 PM", "3 AM"];

const roundedTopBarPath = (x: number, width: number, height: number) => {
  const top = BASELINE_Y - height;
  const r = Math.min(4, height);
  return `M${x} ${BASELINE_Y}V${top + r}Q${x} ${top} ${x + r} ${top}H${x + width - r}Q${x + width} ${top} ${x + width} ${top + r}V${BASELINE_Y}Z`;
};

export function SalesChart({ values }: { values: readonly number[] }) {
  const bucketWidth = PLOT_WIDTH / Math.max(values.length, 1);
  return (
    <View style={styles.card} accessibilityLabel={`Sales chart, ${values.reduce((a, b) => a + b, 0)} orders`}>
      <Svg width={CHART_WIDTH} height={CHART_HEIGHT} style={StyleSheet.absoluteFill}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Line key={`v${i}`} x1={PLOT_LEFT + i * 60} y1={0} x2={PLOT_LEFT + i * 60} y2={169} stroke={colors.skeleton} strokeWidth={1} />
        ))}
        {[14, 54, 94, 134].map((y) => (
          <Line key={`h${y}`} x1={25} y1={y} x2={CHART_WIDTH} y2={y} stroke={colors.skeleton} strokeWidth={1} />
        ))}
        {values.map((value, i) =>
          value > 0 ? (
            <Path
              key={`b${i}`}
              d={roundedTopBarPath(PLOT_LEFT + i * bucketWidth + (bucketWidth - 20) / 2, 20, Math.max(18, value * PIXELS_PER_UNIT))}
              fill={colors.primary}
            />
          ) : null,
        )}
        <Line x1={15} y1={BASELINE_Y + 1} x2={CHART_WIDTH} y2={BASELINE_Y + 1} stroke={palette.primary[400]} strokeWidth={2} strokeDasharray="6 4" />
      </Svg>
      <View style={styles.yAxis}>
        {Y_AXIS_LABELS.map((label) => (
          <Text key={label} size={12} weight={500} lineHeight={14.4} color={colors.textSubtle} align="center">
            {label}
          </Text>
        ))}
      </View>
      <View style={styles.xAxis}>
        {X_AXIS_LABELS.map((label) => (
          <Text key={label} size={12} weight={500} lineHeight={14.4} color={colors.textSubtle}>
            {label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: CHART_WIDTH, height: CHART_HEIGHT, alignSelf: "center", backgroundColor: colors.white, borderRadius: 12, overflow: "hidden" },
  yAxis: { position: "absolute", left: 0, top: 11, width: 20, gap: 24 },
  xAxis: { position: "absolute", left: 15, top: 172, flexDirection: "row", gap: 28 },
});
