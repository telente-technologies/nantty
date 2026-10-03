import { Image } from "expo-image";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Cancel20Icon, Play24Icon } from "@/components/icons";
import { UploadProgressRing } from "@/components/media/uploadProgressRing";
import { UploadProgressBar } from "@/components/media/uploadProgressBar";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { useUploadJobLocalPreview } from "@/store/uploadQueue.store";
import type { ID } from "@/types";

import type { PostDraftMediaItem } from "./postDraftUploads.hook";

export interface DraftMediaStripProps {
  readonly items: readonly PostDraftMediaItem[];
  readonly maximumItems: number;
  readonly onRemoveItem: (jobId: ID) => void;
}

function DraftThumbnailImage({ jobId, uri }: { jobId: ID; uri: string }) {
  const blurhash = useUploadJobLocalPreview(jobId);
  return (
    <Image
      source={{ uri }}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      cachePolicy="memory"
      placeholder={blurhash ? { blurhash } : undefined}
    />
  );
}

export function DraftMediaStrip({ items, maximumItems, onRemoveItem }: DraftMediaStripProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  if (items.length === 0) return null;
  return (
    <View style={styles.root}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbs}>
        {items.map((item, index) => (
          <View key={item.jobId} style={styles.thumb} accessibilityLabel={`${item.mediaType === "video" ? "Video" : "Photo"} ${index + 1} of ${items.length}`}>
            <DraftThumbnailImage jobId={item.jobId} uri={item.previewUri} />
            <UploadProgressRing jobId={item.jobId} />
            {item.mediaType === "video" ? (
              <View style={styles.videoBadge} pointerEvents="none">
                <Play24Icon size={14} color={colors.white} />
              </View>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${item.mediaType === "video" ? "video" : "photo"} ${index + 1}`}
              hitSlop={8}
              onPress={() => onRemoveItem(item.jobId)}
              style={styles.remove}
            >
              <Cancel20Icon size={14} color={colors.white} />
            </Pressable>
            <View style={styles.progress}>
              <UploadProgressBar jobId={item.jobId} showLabel={false} />
            </View>
          </View>
        ))}
      </ScrollView>
      <Text size={12} lineHeight={16.8} color={colors.textMuted}>
        {items.length}/{maximumItems} photos and videos
      </Text>
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  root: { gap: 8 },
  thumbs: { gap: 8 },
  thumb: { width: 96, height: 96, borderRadius: 12, backgroundColor: colors.placeholder, overflow: "hidden" },
  videoBadge: {
    position: "absolute",
    left: 6,
    top: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.overlay,
    alignItems: "center",
    justifyContent: "center",
  },
  remove: {
    position: "absolute",
    right: 6,
    top: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.overlay,
    alignItems: "center",
    justifyContent: "center",
  },
  progress: { position: "absolute", left: 6, right: 6, bottom: 6 },
}));
