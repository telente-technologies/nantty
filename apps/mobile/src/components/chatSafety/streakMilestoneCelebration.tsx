import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet } from "react-native";

import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference.hook";
import { Medal24Icon } from "@/components/icons";

export interface StreakMilestoneCelebrationProps {
  readonly milestoneDays: number;
  readonly peerName: string;
  readonly onDismiss: () => void;
}

export function StreakMilestoneCelebration({ milestoneDays, peerName, onDismiss }: StreakMilestoneCelebrationProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const reduceMotion = useReducedMotionPreference();
  const scale = useRef(new Animated.Value(reduceMotion ? 1 : 0.4)).current;

  useEffect(() => {
    if (reduceMotion) {
      scale.setValue(1);
      return;
    }
    Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }).start();
  }, [reduceMotion, scale]);

  return (
    <Pressable accessibilityRole="alert" accessibilityLabel={`${milestoneDays} day streak with ${peerName}. Tap to dismiss`} onPress={onDismiss} style={styles.overlay}>
      <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
        <Medal24Icon size={64} color="#F59E0B" />
        <Text size={22} weight={700} lineHeight={28} align="center">{milestoneDays} day streak!</Text>
        <Text size={14} lineHeight={20} color={colors.textMuted} align="center">You and {peerName} kept the flame alive. Tap to keep chatting.</Text>
      </Animated.View>
    </Pressable>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center", zIndex: 20 },
  card: { width: 280, padding: 24, gap: 8, borderRadius: 20, backgroundColor: colors.surface },
}));
