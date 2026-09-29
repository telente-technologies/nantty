import { BlurView } from "expo-blur";
import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";

const TIPS = [
  { title: "Go forward", hint: "Tap the screen" },
  { title: "Go back", hint: "Drag down" },
] as const;

export function GestureTipsOverlay({ onDismiss }: { onDismiss: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Tap to keep watching" onPress={onDismiss} style={StyleSheet.absoluteFill}>
      <BlurView intensity={30} tint="light" style={StyleSheet.absoluteFill} />
      <View style={styles.dim} />
      <View style={styles.center}>
        <View style={styles.heading}>
          <Text size={14} weight={500} lineHeight={16.8} align="center">
            Watching stories
          </Text>
          <Text size={12} lineHeight={16.8} color={colors.textMuted} align="center">
            You can use these gestures to control playback
          </Text>
        </View>
        <View style={styles.tips}>
          {TIPS.map((tip) => (
            <View key={tip.title} style={styles.tip}>
              <View style={styles.phone} />
              <View>
                <Text size={13} weight={500} lineHeight={16.9}>
                  {tip.title}
                </Text>
                <Text size={12} lineHeight={16.8} color={colors.textMuted}>
                  {tip.hint}
                </Text>
              </View>
            </View>
          ))}
        </View>
        <Text size={13} weight={500} lineHeight={16.9} align="center" style={styles.keepWatching}>
          Tap to keep watching
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  dim: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.1)" },
  center: { position: "absolute", top: 190, left: 0, right: 0, alignItems: "center" },
  heading: { width: 176, gap: 0 },
  tips: { marginTop: 32, gap: 48 },
  tip: { flexDirection: "row", alignItems: "center", gap: 13 },
  phone: { width: 32, height: 40, backgroundColor: "#444444" },
  keepWatching: { marginTop: 128 },
});
