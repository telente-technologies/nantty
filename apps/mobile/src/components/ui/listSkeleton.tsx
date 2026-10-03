import { View } from "react-native";

import { Skeleton } from "./skeleton";

export interface ListSkeletonProps {
  readonly rows?: number;
  readonly avatarSize?: number;
  readonly padding?: number;
}

export function ListSkeleton({ rows = 6, avatarSize = 44, padding = 16 }: ListSkeletonProps) {
  return (
    <View accessible accessibilityLabel="Loading" accessibilityRole="progressbar" style={{ padding, gap: 16 }}>
      {Array.from({ length: rows }, (_, index) => (
        <View key={index} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Skeleton width={avatarSize} height={avatarSize} radius={avatarSize / 2} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton width="70%" height={14} />
            <Skeleton width="45%" height={12} />
          </View>
        </View>
      ))}
    </View>
  );
}
