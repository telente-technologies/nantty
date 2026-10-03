import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

import { makeThemedStyles } from "@/theme";

const DOT_COUNT = 3;
const DOT_BOUNCE_DURATION_MS = 320;
const DOT_STAGGER_MS = 160;

function BouncingDot({ staggerMs }: { readonly staggerMs: number }) {
  const styles = useStyles();
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(staggerMs),
        Animated.timing(translateY, { toValue: -4, duration: DOT_BOUNCE_DURATION_MS, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: DOT_BOUNCE_DURATION_MS, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [staggerMs, translateY]);

  return <Animated.View style={[styles.dot, { transform: [{ translateY }] }]} />;
}

export function TypingDots() {
  const styles = useStyles();
  return (
    <View style={styles.row} accessibilityRole="text" accessibilityLabel="Typing" accessible>
      {Array.from({ length: DOT_COUNT }, (_, index) => (
        <BouncingDot key={index} staggerMs={index * DOT_STAGGER_MS} />
      ))}
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.skeleton,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.textMuted,
  },
}));
