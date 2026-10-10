import { Image } from "expo-image";
import { Pressable, StyleSheet, View } from "react-native";

import { BrandBilibili20Icon, Play24Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { Post, SavedItem } from "@/types";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

export const SAVED_TILE_ASPECT_RATIO = 130 / 170;

const coverImageForPost = (post: Post) => {
  const media = post.media[0];
  return media ? (media.type === "video" ? media.posterUrl ?? null : media.url) : null;
};

const describeSavedItem = (item: SavedItem) => {
  if (item.type === "product") return `Saved product, ${item.product.name}, ${formatMoneyForDisplay(item.product.price)}`;
  if (item.type === "clip") return `Saved clip by ${item.clip.author.name}`;
  if (item.type === "comment") return `Saved reply by ${item.comment.author.name}: ${item.comment.text.slice(0, 80)}`;
  return `Saved ${item.type} by ${item.post.author.name}${item.post.text ? `: ${item.post.text.slice(0, 80)}` : ""}`;
};

export interface SavedItemTileProps {
  readonly item: SavedItem;
  readonly width: number;
  readonly onPress: () => void;
}

export function SavedItemTile({ item, width, onPress }: SavedItemTileProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const coverUrl = item.type === "product" ? item.product.imageUrl : item.type === "clip" ? coverImageForPost(item.clip) : item.type === "comment" ? null : coverImageForPost(item.post);
  const textOnlyPost = item.type === "comment" ? `@${item.comment.author.username}: ${item.comment.text}` : item.type === "post" && !coverUrl ? item.post.text : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={describeSavedItem(item)}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, { width, height: width / SAVED_TILE_ASPECT_RATIO }, pressed && styles.pressed]}
    >
      {coverUrl ? <Image source={{ uri: coverUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={120} /> : null}
      {textOnlyPost ? (
        <View style={styles.textOnly}>
          <Text size={12} lineHeight={16.8} numberOfLines={6}>
            {textOnlyPost}
          </Text>
        </View>
      ) : null}
      {item.type === "video" ? (
        <View style={styles.cornerBadge} pointerEvents="none">
          <Play24Icon size={16} color={colors.white} />
        </View>
      ) : null}
      {item.type === "clip" ? (
        <View style={styles.cornerBadge} pointerEvents="none">
          <BrandBilibili20Icon size={16} color={colors.white} />
        </View>
      ) : null}
      {item.type === "product" ? (
        <View style={styles.priceLabel} pointerEvents="none">
          <Text size={12} weight={500} lineHeight={14.4} color={colors.white} numberOfLines={1}>
            {formatMoneyForDisplay(item.product.price)}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const useStyles = makeThemedStyles((colors) =>
  StyleSheet.create({
    tile: { backgroundColor: colors.placeholder, overflow: "hidden" },
    pressed: { opacity: 0.85 },
    textOnly: { ...StyleSheet.absoluteFill, backgroundColor: colors.surface, padding: 10 },
    cornerBadge: { position: "absolute", top: 6, right: 6, width: 24, height: 24, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" },
    priceLabel: { position: "absolute", left: 6, bottom: 6, maxWidth: "88%", paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4, backgroundColor: "rgba(0,0,0,0.6)" },
  }),
);
