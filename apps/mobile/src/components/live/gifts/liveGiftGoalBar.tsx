import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import type { LiveGiftGoal } from "@/types";

import { LiveGiftParticleBurst } from "./liveGiftParticles";
import { liveGlass } from "../liveSurface.constant";
import { Check16Icon } from "@/components/icons";

const CELEBRATION_MS = 3_200;

function LiveGiftGoalCelebration({ title }: { title: string }) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration: CELEBRATION_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [progress]);
  const opacity = progress.interpolate({ inputRange: [0, 0.08, 0.85, 1], outputRange: [0, 1, 1, 0] });
  const scale = progress.interpolate({ inputRange: [0, 0.12, 0.2, 1], outputRange: [0.4, 1.2, 1, 1] });
  return (
    <View pointerEvents="none" style={styles.celebration} accessibilityLiveRegion="assertive" accessibilityLabel={`Goal reached: ${title}`}>
      <LiveGiftParticleBurst progress={progress} assetKey="fireworks-v1" count={24} distance={150} />
      <Animated.View style={[styles.celebrationPill, { opacity, transform: [{ scale }] }]}>
        <Text size={18} weight={700} lineHeight={22} color={liveGlass.ink} align="center">
          Goal reached!
        </Text>
        <Text size={13} lineHeight={17} color="#FFE14D" align="center" numberOfLines={1}>
          {title}
        </Text>
      </Animated.View>
    </View>
  );
}

export function LiveGiftGoalBar({ goal, onPress }: { goal: LiveGiftGoal; onPress?: () => void }) {
  const [celebrationKey, setCelebrationKey] = useState(0);
  const previousStatus = useRef(goal.status);
  const fill = useRef(new Animated.Value(0)).current;
  const ratio = Math.min(1, goal.progressCoins / Math.max(1, goal.targetCoins));

  useEffect(() => {
    Animated.timing(fill, { toValue: ratio, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [fill, ratio]);

  useEffect(() => {
    if (previousStatus.current === "active" && goal.status === "completed") setCelebrationKey(Date.now());
    previousStatus.current = goal.status;
  }, [goal.status]);

  useEffect(() => {
    if (!celebrationKey) return;
    const timer = setTimeout(() => setCelebrationKey(0), CELEBRATION_MS);
    return () => clearTimeout(timer);
  }, [celebrationKey]);

  const width = fill.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });
  return (
    <>
      <Pressable
        accessibilityRole={onPress ? "button" : "text"}
        accessibilityLabel={`Gift goal ${goal.title}, ${goal.progressCoins} of ${goal.targetCoins} coins${onPress ? ", tap to edit" : ""}`}
        disabled={!onPress}
        onPress={onPress}
        style={styles.bar}
      >
        <View style={styles.labels}>
          <View style={styles.title}>
            {goal.status === "completed" ? <Check16Icon size={12} color={liveGlass.ink} /> : null}
            <Text size={11} weight={600} lineHeight={14} color={liveGlass.ink} numberOfLines={1} style={styles.titleText}>
              {goal.title}
            </Text>
          </View>
          <Text size={11} lineHeight={14} color="rgba(255,255,255,0.85)">
            {goal.progressCoins.toLocaleString("en-US")}/{goal.targetCoins.toLocaleString("en-US")}
          </Text>
        </View>
        <View style={styles.track}>
          <Animated.View style={[styles.fill, { width }]} />
        </View>
      </Pressable>
      {celebrationKey ? <LiveGiftGoalCelebration key={celebrationKey} title={goal.title} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  bar: { width: 168, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: liveGlass.background, borderWidth: StyleSheet.hairlineWidth, borderColor: liveGlass.border, gap: 4 },
  labels: { flexDirection: "row", justifyContent: "space-between", gap: 6 },
  title: { flexShrink: 1, flexDirection: "row", alignItems: "center", gap: 4 },
  titleText: { flexShrink: 1 },
  track: { height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.25)", overflow: "hidden" },
  fill: { height: 5, borderRadius: 3, backgroundColor: "#FFC233" },
  celebration: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center" },
  celebrationPill: { paddingHorizontal: 22, paddingVertical: 12, borderRadius: 16, backgroundColor: liveGlass.backgroundStrong, borderWidth: StyleSheet.hairlineWidth, borderColor: liveGlass.border, maxWidth: "80%" },
});
