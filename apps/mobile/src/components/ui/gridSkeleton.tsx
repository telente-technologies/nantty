import { StyleSheet, View } from "react-native";

import { Skeleton } from "./skeleton";
import { spacing } from "@/constants/spacing.constant";

export interface GridSkeletonProps {
  readonly items?: number;
  readonly imageHeight?: number;
  readonly cardWidth?: number | `${number}%`;
}

export function GridSkeleton({ items = 6, imageHeight = 170, cardWidth = "48%" }: GridSkeletonProps) {
  return (
    <View accessible accessibilityLabel="Loading" accessibilityRole="progressbar" style={styles.grid}>
      {Array.from({ length: items }, (_, index) => (
        <View key={index} style={[styles.card, { width: cardWidth }]}>
          <Skeleton height={imageHeight} radius={8} />
          <Skeleton width="80%" height={14} />
          <Skeleton width="40%" height={12} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: spacing[4] },
  card: { gap: spacing[2] },
});
