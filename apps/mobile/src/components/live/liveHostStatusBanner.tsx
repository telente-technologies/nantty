import { ActivityIndicator, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import type { LiveHostNotice } from "@/services/live/liveMediaPolicy.util";

export interface LiveHostStatusBannerProps {
  readonly notice: LiveHostNotice | null;
  readonly topOffset: number;
}

const NOTICE_COPY: Readonly<Record<Exclude<LiveHostNotice, "reconnecting">, string>> = {
  mockPreview: "Preview only: mock mode doesn't stream, so nobody else can see your camera.",
  noVideoEngine: "Video streaming isn't in this build yet, so viewers see your cover photo.",
  videoFailed: "Your video couldn't connect, so viewers see your cover photo. Your live stays on.",
  backgroundPaused: "Your video paused while Nantty was in the background. Viewers saw your cover photo.",
  weakConnection: "Weak connection. Viewers may see lower quality video.",
};

const NOTICE_TEST_IDS: Readonly<Record<LiveHostNotice, string>> = {
  reconnecting: "live-host-reconnecting",
  mockPreview: "live-host-preview-only",
  noVideoEngine: "live-host-preview-only",
  videoFailed: "live-host-video-failed",
  backgroundPaused: "live-host-background-paused",
  weakConnection: "live-host-weak-connection",
};

export function LiveHostStatusBanner({ notice, topOffset }: LiveHostStatusBannerProps) {
  if (notice === null) return null;
  return (
    <View style={[styles.wrap, { top: topOffset }]} pointerEvents="none">
      {notice === "reconnecting" ? (
        <View style={styles.pill} accessibilityRole="alert" accessibilityLiveRegion="polite" testID={NOTICE_TEST_IDS.reconnecting}>
          <ActivityIndicator size="small" color="#FFFFFF" />
          <Text size={13} weight={600} lineHeight={17} color="#FFFFFF">Reconnecting… your live stays on</Text>
        </View>
      ) : (
        <View style={styles.pill} accessibilityLiveRegion="polite" testID={NOTICE_TEST_IDS[notice]}>
          <Text size={12} lineHeight={16} color="#FFFFFF" align="center">{NOTICE_COPY[notice]}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, alignItems: "center", paddingHorizontal: 16, zIndex: 5 },
  pill: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: "rgba(16,16,24,0.82)", maxWidth: 360 },
});
