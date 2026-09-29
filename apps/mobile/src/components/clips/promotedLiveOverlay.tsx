import { Pressable, StyleSheet, View } from "react-native";

import { LiveBadge } from "@/components/live/liveBadge";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";

export interface PromotedLiveOverlayProps {
  readonly topInset: number;
  readonly viewers: number;
  readonly onWatchLive: () => void;
}

export function PromotedLiveOverlay({ topInset, viewers, onWatchLive }: PromotedLiveOverlayProps) {
  return (
    <>
      <View style={[styles.badge, { top: topInset + 56 }]} pointerEvents="none">
        <LiveBadge viewers={viewers} />
      </View>
      <View style={styles.center} pointerEvents="box-none">
        <Pressable accessibilityRole="button" accessibilityLabel="Watch live" onPress={onWatchLive} style={styles.watchButton}>
          <Text size={14} weight={600} lineHeight={16.8} color={colors.white}>
            Watch live
          </Text>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  badge: { position: "absolute", left: 16 },
  center: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  watchButton: { height: 40, paddingHorizontal: 20, borderRadius: 20, backgroundColor: colors.live, justifyContent: "center" },
});
