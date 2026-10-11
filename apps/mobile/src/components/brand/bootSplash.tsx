import { useEffect, useState } from "react";
import { Image, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import Animated from "react-native-reanimated";
import { initialWindowMetrics } from "react-native-safe-area-context";

import { useBreathingStyle } from "@/components/ui/brandLoader";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference.hook";
import { makeThemedStyles } from "@/theme";

import { ZudomartWordmark } from "./zudomartWordmark";

const splashLogo = require("../../../assets/splashLogo.png");

const NATIVE_SPLASH_LOGO_SIZE = 160;
const WORDMARK_HEIGHT = 28;
const WORDMARK_BOTTOM_GAP = 40;
const BREATHE_AFTER_MS = 600;

export function BootSplash({ onLayout }: { readonly onLayout?: (event: LayoutChangeEvent) => void }) {
  const styles = useStyles();
  const bottom = (initialWindowMetrics?.insets.bottom ?? 0) + WORDMARK_BOTTOM_GAP;
  const reduceMotion = useReducedMotionPreference();
  const [isWaiting, setIsWaiting] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setIsWaiting(true), BREATHE_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);
  const breathing = useBreathingStyle(isWaiting && !reduceMotion);
  return (
    <View style={styles.root} onLayout={onLayout} accessible accessibilityRole="image" accessibilityLabel="Zudomart">
      <Animated.View style={breathing}>
        <Image source={splashLogo} style={styles.logo} fadeDuration={0} />
      </Animated.View>
      <View style={[styles.wordmark, { bottom }]}>
        <ZudomartWordmark height={WORDMARK_HEIGHT} />
      </View>
    </View>
  );
}

const useStyles = makeThemedStyles((colors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
    logo: { width: NATIVE_SPLASH_LOGO_SIZE, height: NATIVE_SPLASH_LOGO_SIZE },
    wordmark: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  }),
);
