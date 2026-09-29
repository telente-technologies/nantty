import { Image } from "expo-image";
import { useState } from "react";
import { FlatList, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";

import { ViewProducts24Icon } from "@/components/icons";
import { colors } from "@/constants/colors.constant";
import type { Media } from "@/types";

export interface MediaPagerProps {
  readonly media: readonly Media[];
  readonly height?: number;
  readonly onPressViewProducts?: () => void;
}

export function MediaPager({ media, height = 335, onPressViewProducts }: MediaPagerProps) {
  const { width } = useWindowDimensions();
  const pageWidth = Math.min(width, 393);
  const [page, setPage] = useState(0);
  const pages = media.length > 0 ? media : [{ type: "image" as const, url: null }];
  return (
    <View style={[styles.root, { height }]}>
      <FlatList
        data={pages}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, i) => String(i)}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / pageWidth))}
        renderItem={({ item }) => (
          <View style={{ width: pageWidth, height }}>
            {item.url ? <Image source={{ uri: item.url }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
          </View>
        )}
      />
      <View style={styles.overlay} pointerEvents="box-none">
        <PageIndicator count={Math.max(pages.length, 4)} active={page} />
        {onPressViewProducts ? (
          <Pressable accessibilityRole="button" accessibilityLabel="View products in this post" hitSlop={10} onPress={onPressViewProducts}>
            <ViewProducts24Icon />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function PageIndicator({ count, active }: { count: number; active: number }) {
  return (
    <View style={styles.indicator} accessibilityLabel={`Image ${active + 1} of ${count}`}>
      {Array.from({ length: count }, (_, i) =>
        i === active ? <View key={i} style={styles.activeDot} /> : <View key={i} style={styles.dot} />,
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.media, overflow: "hidden" },
  overlay: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 8,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  indicator: {
    height: 8,
    paddingHorizontal: 4,
    borderRadius: 99,
    backgroundColor: colors.avatar,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginBottom: 0,
  },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.placeholder },
  activeDot: { width: 24, height: 4, borderRadius: 21, backgroundColor: "#0D0D0D" },
});
