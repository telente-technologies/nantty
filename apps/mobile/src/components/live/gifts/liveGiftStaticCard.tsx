import { useEffect } from "react";
import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";

import { LiveGiftArtwork } from "./liveGiftArtwork";
import type { LiveGiftAnimationEntry } from "./liveGiftOverlayQueues.hook";

export interface LiveGiftStaticCardProps {
  readonly entry: LiveGiftAnimationEntry;
  readonly streamerUsername: string | null;
  readonly onFinished: () => void;
}

export function LiveGiftStaticCard({ entry, streamerUsername, onFinished }: LiveGiftStaticCardProps) {
  const { event } = entry;
  useEffect(() => {
    const timer = setTimeout(onFinished, Math.min(entry.durationMs, 3_000));
    return () => clearTimeout(timer);
  }, [entry.durationMs, onFinished]);
  const comboSuffix = event.comboCount > 1 ? ` ×${event.comboCount}` : "";
  const recipientSuffix = entry.mode === "global" && streamerUsername ? ` to @${streamerUsername}` : "";
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center]}>
      <View accessible accessibilityLiveRegion="polite" accessibilityLabel={`${event.sender.name} sent ${entry.giftName}`} style={styles.card}>
        <LiveGiftArtwork assetKey={event.animationAssetKey} size={96} />
        <Text size={16} weight={700} lineHeight={22} color={colors.white} align="center" numberOfLines={1}>{event.sender.name}</Text>
        <Text size={13} weight={600} lineHeight={17} color="#FFE14D" align="center">{`sent ${entry.giftName}${comboSuffix}${recipientSuffix}`}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  card: { alignItems: "center", gap: 6, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 16, backgroundColor: "rgba(0,0,0,0.6)", maxWidth: "84%" },
});
