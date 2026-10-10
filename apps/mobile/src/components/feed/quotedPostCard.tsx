import { Image } from "expo-image";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import { Cancel20Icon, Play24Icon } from "@/components/icons";
import { VerificationBadge } from "@/components/profile/verificationBadge";
import { Avatar } from "@/components/ui/avatar";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { QuotedPostSummary } from "@/types";
import { formatTimeSincePosted } from "@/utils/formatDate.util";

export const QUOTED_POST_UNAVAILABLE_TEXT = "This post is unavailable.";

export interface QuotedPostCardProps {
  readonly quoted: QuotedPostSummary | null;
  readonly unavailable?: boolean;
  readonly loading?: boolean;
  readonly onPress?: () => void;
  readonly onRemove?: () => void;
  readonly compact?: boolean;
}

export function QuotedPostCard({ quoted, unavailable, loading, onPress, onRemove, compact }: QuotedPostCardProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const removeButton = onRemove ? (
    <Pressable accessibilityRole="button" accessibilityLabel="Remove quoted post" hitSlop={10} onPress={onRemove} style={styles.remove}>
      <Cancel20Icon color={colors.text} />
    </Pressable>
  ) : null;

  if (loading || unavailable || !quoted) {
    return (
      <View style={[styles.card, compact ? styles.compact : null, styles.placeholderRow]} accessibilityRole="text">
        {loading ? <ActivityIndicator size="small" color={colors.textMuted} /> : null}
        <Text size={14} lineHeight={19} color={colors.textMuted} style={styles.flex}>
          {loading ? "Loading post…" : QUOTED_POST_UNAVAILABLE_TEXT}
        </Text>
        {removeButton}
      </View>
    );
  }

  const thumbnail = quoted.thumbnail;
  const textOnlyMedia = !quoted.text && thumbnail;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Quoted post by ${quoted.author.name}: ${quoted.text}`}
      disabled={!onPress}
      onPress={onPress}
      style={[styles.card, compact ? styles.compact : null]}
    >
      <View style={styles.header}>
        <Avatar uri={quoted.author.avatarUrl} size={20} />
        <Text size={14} weight={600} lineHeight={18} numberOfLines={1} style={styles.name}>
          {quoted.author.name}
        </Text>
        <VerificationBadge verification={quoted.author.verification} legacyVerified={quoted.author.verified} size={14} />
        <Text size={14} lineHeight={18} color={colors.textMuted} numberOfLines={1} style={styles.handle}>
          @{quoted.author.username} · {formatTimeSincePosted(quoted.createdAt)}
        </Text>
        {removeButton}
      </View>
      {quoted.text ? (
        <View style={styles.bodyRow}>
          <Text size={14} lineHeight={19} numberOfLines={3} style={styles.flex}>
            {quoted.text}
          </Text>
          {thumbnail ? <Thumbnail url={thumbnail.url} isVideo={thumbnail.type === "video"} size={64} /> : null}
        </View>
      ) : null}
      {textOnlyMedia && thumbnail ? <Thumbnail url={thumbnail.url} isVideo={thumbnail.type === "video"} /> : null}
    </Pressable>
  );
}

function Thumbnail({ url, isVideo, size }: { readonly url: string; readonly isVideo: boolean; readonly size?: number }) {
  const styles = useStyles();
  return (
    <View style={size ? [styles.thumbnail, { width: size, height: size }] : [styles.thumbnail, styles.wideThumbnail]}>
      <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={120} accessibilityIgnoresInvertColors />
      {isVideo ? (
        <View style={styles.play}>
          <Play24Icon size={16} color="#FFFFFF" />
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  card: { marginHorizontal: 16, padding: 12, gap: 6, borderWidth: 1, borderColor: colors.divider, borderRadius: 16, backgroundColor: colors.surface, overflow: "hidden" },
  compact: { marginHorizontal: 0 },
  placeholderRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  header: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { flexShrink: 1 },
  handle: { flexShrink: 2 },
  flex: { flex: 1 },
  bodyRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  thumbnail: { borderRadius: 10, overflow: "hidden", backgroundColor: colors.placeholder, alignItems: "center", justifyContent: "center" },
  wideThumbnail: { width: "100%", aspectRatio: 16 / 9 },
  play: { width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" },
  remove: { marginLeft: "auto", padding: 2 },
}));
