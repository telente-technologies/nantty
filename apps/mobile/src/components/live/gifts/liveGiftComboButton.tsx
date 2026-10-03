import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference.hook";

import { LiveGiftArtwork } from "./liveGiftArtwork";
import type { LiveGiftComboWindow } from "./sendLiveGift.hook";

const RING_SIZE = 76;
const RING_STROKE = 5;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface LiveGiftComboButtonProps {
  readonly comboWindow: LiveGiftComboWindow;
  readonly windowMs: number;
  readonly onComboTap: () => void;
  readonly onWindowEnded: () => void;
}

export function LiveGiftComboButton({ comboWindow, windowMs, onComboTap, onWindowEnded }: LiveGiftComboButtonProps) {
  const countdown = useRef(new Animated.Value(0)).current;
  const bump = useRef(new Animated.Value(1)).current;
  const reducedMotion = useReducedMotionPreference();

  useEffect(() => {
    countdown.setValue(0);
    const animation = Animated.timing(countdown, { toValue: 1, duration: windowMs, easing: Easing.linear, useNativeDriver: false });
    animation.start(({ finished }) => {
      if (finished) onWindowEnded();
    });
    if (!reducedMotion) {
      bump.setValue(1.18);
      Animated.spring(bump, { toValue: 1, friction: 4, tension: 180, useNativeDriver: true }).start();
    }
    return () => animation.stop();
  }, [bump, comboWindow.lastSentAt, countdown, onWindowEnded, reducedMotion, windowMs]);

  const strokeDashoffset = countdown.interpolate({ inputRange: [0, 1], outputRange: [0, RING_CIRCUMFERENCE] });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Send ${comboWindow.gift.name} again, combo ${comboWindow.comboCount}`}
      onPress={onComboTap}
      style={styles.wrapper}
    >
      <Animated.View style={[styles.ringBox, { transform: [{ scale: bump }] }]}>
        <Svg width={RING_SIZE} height={RING_SIZE} style={StyleSheet.absoluteFill}>
          <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_RADIUS} stroke="rgba(255,255,255,0.25)" strokeWidth={RING_STROKE} fill={colors.primary} />
          <AnimatedCircle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            stroke="#FFE14D"
            strokeWidth={RING_STROKE}
            fill="none"
            strokeDasharray={`${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
          />
        </Svg>
        <View style={styles.content}>
          <LiveGiftArtwork assetKey={comboWindow.gift.previewAssetKey} size={26} />
          <Text size={13} weight={700} lineHeight={15} color={colors.white}>
            Combo
          </Text>
        </View>
      </Animated.View>
      <Text size={22} weight={700} lineHeight={26} color={colors.primary} style={styles.count}>
        ×{comboWindow.comboCount}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: "absolute", right: 16, bottom: 86, alignItems: "center" },
  ringBox: { width: RING_SIZE, height: RING_SIZE, alignItems: "center", justifyContent: "center" },
  content: { alignItems: "center" },
  count: { fontStyle: "italic", marginTop: 2 },
});
