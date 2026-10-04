import { BlurView } from "expo-blur";
import { StyleSheet, View } from "react-native";

import { PauseFill24Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";

export interface LiveSafetyOverlayProps {
  readonly message?: string;
}

export function LiveSafetyOverlay({ message }: LiveSafetyOverlayProps) {
  const styles = useStyles();
  const { colors, isDark } = useTheme();
  return (
    <View style={StyleSheet.absoluteFill} accessibilityViewIsModal accessibilityLiveRegion="polite">
      <BlurView intensity={90} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
      <View style={styles.scrim} />
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <PauseFill24Icon size={24} color={colors.text} />
        </View>
        <Text size={17} weight={600} lineHeight={22} align="center">{message || "This live is paused while we review it"}</Text>
        <Text size={14} lineHeight={19.6} align="center" style={styles.subtext}>
          Our safety team is checking this live. It will continue here if it follows our community guidelines.
        </Text>
      </View>
    </View>
  );
}

const useStyles = makeThemedStyles((colors, scheme) => StyleSheet.create({
  scrim: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: scheme === "dark" ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.55)" },
  content: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 12 },
  iconCircle: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", backgroundColor: colors.chip },
  subtext: { color: colors.textMuted },
}));
