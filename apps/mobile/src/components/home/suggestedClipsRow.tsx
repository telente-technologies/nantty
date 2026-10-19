import { Image } from "expo-image";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { DotsThreeVertical24Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { SuggestedClip } from "@/types/commerce.type";
import { horizontalScrollGestureGuardProps } from "@/components/home/horizontalScrollGestureGuard.util";

export interface SuggestedClipsRowProps {
  readonly clips: readonly (SuggestedClip & { readonly authorName?: string })[];
  readonly onPressClip: (clipId: string) => void;
  readonly onPressMore?: () => void;
}

export function SuggestedClipsRow({ clips, onPressClip, onPressMore }: SuggestedClipsRowProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <View style={styles.titleRow}>
        <Text size={14} weight={600} lineHeight={16.9} letterSpacing={0} accessibilityRole="header">
          Suggested Clips
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel="More options for suggested clips" hitSlop={10} onPress={onPressMore} disabled={!onPressMore}>
          <DotsThreeVertical24Icon color={colors.text} />
        </Pressable>
      </View>
      <ScrollView horizontal {...horizontalScrollGestureGuardProps} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.slider}>
        {clips.map((clip, index) => (
          <Pressable
            key={clip.id}
            accessibilityRole="button"
            accessibilityLabel={clip.authorName ? `Play suggested clip by ${clip.authorName}` : `Play suggested clip ${index + 1}`}
            onPress={() => onPressClip(clip.id)}
            style={styles.clip}
          >
            {clip.thumbnailUrl ? <Image source={{ uri: clip.thumbnailUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  section: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.textSubtle,
    paddingVertical: 12,
    gap: 12,
  },
  titleRow: { height: 24, paddingHorizontal: 16, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  slider: { paddingHorizontal: 16, gap: 8 },
  clip: { width: 160, height: 230, borderRadius: 8, backgroundColor: colors.placeholder, overflow: "hidden" },
}));
