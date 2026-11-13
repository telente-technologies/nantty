import { Image } from "expo-image";
import { useState } from "react";
import { FlatList, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";

import { useImagePreview } from "@/components/ui/previewableImage";
import { Text } from "@/components/ui/text";
import { makeThemedStyles } from "@/theme";

export interface ProductGalleryProps {
  readonly images: readonly string[];
  readonly fallbackImageUrl?: string | null;
  readonly promo: string | null;
}

export function ProductGallery({ images, fallbackImageUrl, promo }: ProductGalleryProps) {
  const styles = useStyles();
  const { width } = useWindowDimensions();
  const pageWidth = Math.min(width, 393);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const { openImagePreview, imagePreviewElement } = useImagePreview();
  const galleryImages = images.length > 0 ? images : fallbackImageUrl ? [fallbackImageUrl] : [];
  const pages: (string | null)[] = galleryImages.length > 0 ? [...galleryImages] : [null, null, null, null];

  return (
    <View>
      <FlatList
        data={pages}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={pageWidth}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum
        keyExtractor={(_, index) => String(index)}
        getItemLayout={(_, index) => ({ length: pageWidth, offset: pageWidth * index, index })}
        onMomentumScrollEnd={(e) => setActiveImageIndex(Math.round(e.nativeEvent.contentOffset.x / pageWidth))}
        renderItem={({ item, index }) => (
          <Pressable
            style={[styles.image, { width: pageWidth }]}
            accessibilityRole={item ? "imagebutton" : "image"}
            accessibilityLabel={`Product image ${index + 1} of ${pages.length}`}
            accessibilityHint={item ? "Opens the image full screen" : undefined}
            disabled={!item}
            onPress={() => openImagePreview(galleryImages, index)}
          >
            {item ? <Image source={{ uri: item }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
          </Pressable>
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
      {imagePreviewElement}
    </View>
  );
}

const useStyles = makeThemedStyles((colors, scheme) => StyleSheet.create({
  image: { height: 418, backgroundColor: colors.textSubtle, overflow: "hidden" },
  promo: {
    height: 33,
    paddingHorizontal: 12,
    justifyContent: "center",
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: scheme === "dark" ? colors.textSubtle : "#8F8F8F",
  },
  indicator: { marginTop: 11, marginLeft: 12, flexDirection: "row", alignItems: "center", gap: 4 },
  bar: { width: 12, height: 4, borderRadius: 21, backgroundColor: colors.placeholder },
  activeBar: { width: 24, height: 4, borderRadius: 21, backgroundColor: colors.primary },
}));
