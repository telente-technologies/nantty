import { Image } from "expo-image";
import { Pressable, StyleSheet, View } from "react-native";

import { Play24Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { Clip } from "@/types";
import { formatCountWithThousandsSuffix } from "@/utils/formatDate.util";

export function SoundClipThumbnail({ clip, width, onPress }: { clip: Clip; width: number; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const posterUrl = clip.media[0]?.posterUrl ?? null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Clip by ${clip.author.name}, ${clip.views} views`}
      onPress={onPress}
      style={[styles.tile, { width, height: Math.round(width * 16 / 9) }]}
    >
      {posterUrl ? (
        <Image source={{ uri: posterUrl }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" recyclingKey={posterUrl} />
      ) : null}
      <View style={styles.views}>
        <Play24Icon size={12} color={colors.white} />
        <Text size={12} weight={500} lineHeight={14.4} color={colors.white}>
          {formatCountWithThousandsSuffix(clip.views)}
        </Text>
      </View>
    </Pressable>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  tile: { backgroundColor: colors.media, overflow: "hidden" },
  views: { position: "absolute", left: 6, bottom: 6, flexDirection: "row", alignItems: "center", gap: 4 },
}));
