import { useEffect } from "react";
import { AccessibilityInfo, Pressable, StyleSheet, View } from "react-native";

import { Trophy24Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { FrameAwareModal } from "@/components/ui/frameAwareModal";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { ActiveCelebration } from "@/types/celebrations.type";

import { FloatingBalloons } from "./floatingBalloons";

export interface CelebrationOverlayProps {
  readonly celebration: ActiveCelebration;
  readonly onDismiss: () => void;
}

export function CelebrationOverlay({ celebration, onDismiss }: CelebrationOverlayProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(celebration.message);
  }, [celebration.message]);
  return (
    <FrameAwareModal visible transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Close celebration" onPress={onDismiss} />
        <FloatingBalloons height={640} count={9} style={styles.balloons} />
        <View style={styles.card} accessibilityRole="alert" accessibilityLiveRegion="polite" accessibilityLabel={celebration.message}>
          <View style={{ width: 56, height: 56, borderRadius: 28, alignSelf: "center", alignItems: "center", justifyContent: "center", backgroundColor: colors.chip }}>
            <Trophy24Icon size={28} color={colors.textMuted} />
          </View>
          <Text size={22} weight={700} lineHeight={28} align="center" accessible={false}>{celebration.title}</Text>
          <Text size={14} lineHeight={20} color={colors.textMuted} align="center" accessible={false}>{celebration.message.slice(celebration.title.length).trim()}</Text>
          {celebration.stats.length > 0 ? (
            <View style={styles.stats} accessible={false}>
              {celebration.stats.map((stat) => (
                <View key={stat.label} style={styles.stat}>
                  <Text size={18} weight={700} lineHeight={22}>{stat.value}</Text>
                  <Text size={12} lineHeight={16} color={colors.textMuted}>{stat.label}</Text>
                </View>
              ))}
            </View>
          ) : null}
          <Button title="Thank you" onPress={onDismiss} />
        </View>
      </View>
    </FrameAwareModal>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  backdrop: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.overlay, paddingHorizontal: 24 },
  balloons: { top: 0 },
  card: { width: "100%", maxWidth: 340, padding: 24, gap: 12, borderRadius: 20, backgroundColor: colors.surface },
  stats: { flexDirection: "row", justifyContent: "space-around", paddingVertical: 12, borderRadius: 12, backgroundColor: colors.background },
  stat: { alignItems: "center", gap: 2 },
}));
