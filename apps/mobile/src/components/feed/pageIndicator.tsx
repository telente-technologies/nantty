import { Animated, StyleSheet, View } from "react-native";

import { makeThemedStyles, useTheme } from "@/theme";

const INACTIVE_DOT_WIDTH = 4;
const ACTIVE_DOT_WIDTH = 24;
const DOT_GAP_FOR_FEW_ITEMS = 2;
const DOT_GAP_FOR_MANY_ITEMS = 1;
const MANY_ITEMS_THRESHOLD = 8;

export interface AnimatedPageIndicatorProps {
  readonly count: number;
  readonly activeIndex: number;
  readonly scrollOffsetX: Animated.Value;
  readonly pageWidth: number;
}

export function AnimatedPageIndicator({ count, activeIndex, scrollOffsetX, pageWidth }: AnimatedPageIndicatorProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  if (count <= 1) return null;
  const dotGap = count >= MANY_ITEMS_THRESHOLD ? DOT_GAP_FOR_MANY_ITEMS : DOT_GAP_FOR_FEW_ITEMS;
  return (
    <View
      style={[styles.pill, { gap: dotGap }]}
      accessibilityRole="adjustable"
      accessibilityLabel={`Item ${activeIndex + 1} of ${count}`}
    >
      {Array.from({ length: count }, (_, dotIndex) => {
        const inputRange = [(dotIndex - 1) * pageWidth, dotIndex * pageWidth, (dotIndex + 1) * pageWidth];
        const width = scrollOffsetX.interpolate({
          inputRange,
          outputRange: [INACTIVE_DOT_WIDTH, ACTIVE_DOT_WIDTH, INACTIVE_DOT_WIDTH],
          extrapolate: "clamp",
        });
        const backgroundColor = scrollOffsetX.interpolate({
          inputRange,
          outputRange: [colors.placeholder, colors.primary, colors.placeholder],
          extrapolate: "clamp",
        });
        return <Animated.View key={dotIndex} style={[styles.dot, { width, backgroundColor }]} />;
      })}
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  pill: {
    height: 8,
    paddingHorizontal: 4,
    borderRadius: 21,
    backgroundColor: colors.avatar,
    flexDirection: "row",
    alignItems: "center",
  },
  dot: { height: 4, borderRadius: 21 },
}));
