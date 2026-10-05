import { Image, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import { initialWindowMetrics } from "react-native-safe-area-context";

import { makeThemedStyles } from "@/theme";

import { ZudomartWordmark } from "./zudomartWordmark";

const splashLogo = require("../../../assets/splashLogo.png");

const NATIVE_SPLASH_LOGO_SIZE = 160;
const WORDMARK_HEIGHT = 28;
const WORDMARK_BOTTOM_GAP = 40;

export function BootSplash({ onLayout }: { readonly onLayout?: (event: LayoutChangeEvent) => void }) {
  const styles = useStyles();
  const bottom = (initialWindowMetrics?.insets.bottom ?? 0) + WORDMARK_BOTTOM_GAP;
  return (
    <View style={styles.root} onLayout={onLayout} accessible accessibilityRole="image" accessibilityLabel="Zudomart">
      <Image source={splashLogo} style={styles.logo} fadeDuration={0} />
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
