import { useEffect } from "react";
import { Pressable, Share, StyleSheet, View } from "react-native";
import Animated, { FadeInDown, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BoxArrowDown24Icon, Cancel20Icon, Share24Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { webAppLinks } from "@/config/webAppLinks.config";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference.hook";
import { useMediaDownloadStore } from "@/store/mediaDownload.store";
import { makeThemedStyles, useTheme } from "@/theme";

import { canOfferDownloadForPost, findFirstDownloadableMedia } from "./downloadablePostMedia.util";

const SCREENSHOT_PROMPT_VISIBLE_MS = 8000;

export function MediaDownloadHost() {
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { paddingBottom: insets.bottom + 72 }]}>
      <View pointerEvents="box-none" style={hostStyles.stack}>
        <ScreenshotSharePrompt />
        <DownloadProgressPill />
      </View>
    </View>
  );
}

function DownloadProgressPill() {
  const activeDownload = useMediaDownloadStore((state) => state.activeDownload);
  const cancelBrandedDownload = useMediaDownloadStore((state) => state.cancelBrandedDownload);
  const styles = useStyles();
  const { colors } = useTheme();
  const reduceMotion = useReducedMotionPreference();
  if (!activeDownload) return null;
  const percent = Math.round(activeDownload.progress * 100);
  const label = activeDownload.progress < 0.5 ? `Adding the Nantty tag… ${percent}%` : `Saving ${activeDownload.mediaType === "video" ? "video" : "photo"}… ${percent}%`;
  return (
    <Animated.View entering={reduceMotion ? undefined : FadeInDown} exiting={reduceMotion ? undefined : FadeOut} style={styles.card} accessibilityLiveRegion="polite">
      <View style={styles.row}>
        <BoxArrowDown24Icon size={20} color={colors.primary} />
        <Text size={14} lineHeight={19} weight={500} style={styles.grow}>{label}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Cancel download" hitSlop={10} onPress={cancelBrandedDownload}>
          <Cancel20Icon color={colors.textMuted} />
        </Pressable>
      </View>
      <View style={styles.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: percent }}>
        <View style={[styles.fill, { width: `${Math.max(4, percent)}%` }]} />
      </View>
    </Animated.View>
  );
}

function ScreenshotSharePrompt() {
  const post = useMediaDownloadStore((state) => state.screenshotPromptPost);
  const dismiss = useMediaDownloadStore((state) => state.dismissScreenshotPrompt);
  const startBrandedDownload = useMediaDownloadStore((state) => state.startBrandedDownload);
  const styles = useStyles();
  const { colors } = useTheme();
  const reduceMotion = useReducedMotionPreference();

  useEffect(() => {
    if (!post) return;
    const timer = setTimeout(dismiss, SCREENSHOT_PROMPT_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [post, dismiss]);

  if (!post) return null;
  const media = canOfferDownloadForPost(post) ? findFirstDownloadableMedia(post) : undefined;
  const shareLink = () => {
    dismiss();
    Share.share({ message: post.kind === "clip" ? webAppLinks.clip(post.id) : webAppLinks.post(post.id) }).catch(() => undefined);
  };
  const saveBrandedCopy = () => {
    dismiss();
    if (media) startBrandedDownload(post.id, media);
  };
  return (
    <Animated.View entering={reduceMotion ? undefined : FadeInDown} exiting={reduceMotion ? undefined : FadeOut} style={styles.card} accessibilityRole="alert">
      <View style={styles.row}>
        <Text size={14} lineHeight={19} weight={600} style={styles.grow}>Share this post?</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" hitSlop={10} onPress={dismiss}>
          <Cancel20Icon color={colors.textMuted} />
        </Pressable>
      </View>
      <Text size={12} lineHeight={16.8} color={colors.textMuted}>
        Send the link, or save a copy that credits @{post.author.username || "the creator"}.
      </Text>
      <View style={styles.row}>
        <Pressable accessibilityRole="button" onPress={shareLink} style={styles.action}>
          <Share24Icon size={18} color={colors.primary} />
          <Text size={13} weight={600} color={colors.primary}>Share link</Text>
        </Pressable>
        {media ? (
          <Pressable accessibilityRole="button" onPress={saveBrandedCopy} style={styles.action}>
            <BoxArrowDown24Icon size={18} color={colors.primary} />
            <Text size={13} weight={600} color={colors.primary}>Save tagged copy</Text>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}

const hostStyles = StyleSheet.create({ stack: { flex: 1, justifyContent: "flex-end", alignItems: "center", gap: 8, paddingHorizontal: 16 } });

const useStyles = makeThemedStyles((colors) =>
  StyleSheet.create({
    card: {
      width: "100%",
      maxWidth: 400,
      gap: 8,
      padding: 14,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.divider,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.16,
      shadowRadius: 20,
      elevation: 8,
    },
    row: { flexDirection: "row", alignItems: "center", gap: 10 },
    grow: { flex: 1 },
    action: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6, paddingRight: 12 },
    track: { height: 4, borderRadius: 2, backgroundColor: colors.divider, overflow: "hidden" },
    fill: { height: 4, borderRadius: 2, backgroundColor: colors.primary },
  }),
);
