import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import type { LiveBattleParticipant } from "@/types/liveStage.type";
import { Lightning24Icon } from "@/components/icons";

const MINIMUM_SIDE_SHARE = 0.08;
export const BATTLE_LEFT_COLOR = "#FF2D6F";
export const BATTLE_RIGHT_COLOR = "#2D7CFF";

const leftShareOfTotal = (left: number, right: number) => {
  const total = left + right;
  if (total === 0) return 0.5;
  return Math.min(1 - MINIMUM_SIDE_SHARE, Math.max(MINIMUM_SIDE_SHARE, left / total));
};

export function BattleTugOfWarBar({ left, right }: { left: LiveBattleParticipant; right: LiveBattleParticipant }) {
  const share = useRef(new Animated.Value(0.5)).current;
  const targetShare = leftShareOfTotal(left.score, right.score);
  useEffect(() => {
    Animated.timing(share, { toValue: targetShare, duration: 400, useNativeDriver: false }).start();
  }, [share, targetShare]);
  const leftWidth = share.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });
  return (
    <View
      style={styles.bar}
      accessibilityRole="progressbar"
      accessibilityLabel={`${left.user.name} ${left.score} coins, ${right.user.name} ${right.score} coins`}
    >
      <View style={[StyleSheet.absoluteFill, { backgroundColor: BATTLE_RIGHT_COLOR }]} />
      <Animated.View style={[styles.leftFill, { width: leftWidth }]} />
      <Animated.View style={[styles.spark, { left: leftWidth }]}>
        <Lightning24Icon size={14} color="#FFFFFF" />
      </Animated.View>
      <Text size={11} weight={700} lineHeight={18} color="#FFFFFF" style={styles.leftScore}>
        {left.score.toLocaleString("en-US")}
      </Text>
      <Text size={11} weight={700} lineHeight={18} color="#FFFFFF" style={styles.rightScore}>
        {right.score.toLocaleString("en-US")}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { height: 18, width: "100%", overflow: "hidden", justifyContent: "center" },
  leftFill: { position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: BATTLE_LEFT_COLOR },
  spark: { position: "absolute", top: 1, marginLeft: -7 },
  leftScore: { position: "absolute", left: 8 },
  rightScore: { position: "absolute", right: 8 },
});
