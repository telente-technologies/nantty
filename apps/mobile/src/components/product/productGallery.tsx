import { Image } from "expo-image";
import { useState } from "react";
import { FlatList, StyleSheet, View, useWindowDimensions } from "react-native";

import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";

export interface ProductGalleryProps {
  readonly images: readonly string[];
  readonly promo: string | null;
}

export function ProductGallery({ images, promo }: ProductGalleryProps) {
  const { width } = useWindowDimensions();
  const pageWidth = Math.min(width, 393);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const pages: (string | null)[] = images.length > 0 ? [...images] : [null, null, null, null];

  return (
    <View>
      <FlatList
        data={pages}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, index) => String(index)}
        onMomentumScrollEnd={(e) => setActiveImageIndex(Math.round(e.nativeEvent.contentOffset.x / pageWidth))}
        renderItem={({ item, index }) => (
          <View style={[styles.image, { width: pageWidth }]} accessibilityLabel={`Product image ${index + 1} of ${pages.length}`}>
            {item ? <Image source={{ uri: item }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
          </View>
        )}
      />
      {promo ? (
        <View style={styles.promo}>
          <Text size={13} lineHeight={16.9}>
            {promo}
          </Text>
        </View>
      ) : null}
      <View style={styles.indicator}>
        {pages.map((_, index) => (
          <View key={index} style={index === activeImageIndex ? styles.activeBar : styles.bar} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  image: { height: 418, backgroundColor: colors.textSubtle, overflow: "hidden" },
  promo: {
    height: 33,
    paddingHorizontal: 12,
    justifyContent: "center",
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#8F8F8F",
  },
  indicator: { marginTop: 11, marginLeft: 12, flexDirection: "row", alignItems: "center", gap: 4 },
  bar: { width: 12, height: 4, borderRadius: 21, backgroundColor: colors.placeholder },
  activeBar: { width: 24, height: 4, borderRadius: 21, backgroundColor: "#0D0D0D" },
});
