import { Pressable, StyleSheet, View } from "react-native";

import { PauseFill24Icon, Warning20Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { LiveSafetyState } from "@/types";

export interface LiveSafetyHostBannerProps {
  readonly safety: LiveSafetyState;
  readonly hasAppealed: boolean;
  readonly onAppeal: () => void;
}

export function LiveSafetyHostBanner({ safety, hasAppealed, onAppeal }: LiveSafetyHostBannerProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const isPaused = safety.state === "paused";
  return (
    <View style={[styles.banner, isPaused ? styles.paused : styles.warning]} accessibilityRole="alert" accessibilityLiveRegion="assertive">
      <View style={styles.row}>
        {isPaused ? <PauseFill24Icon size={18} color={colors.error} /> : <Warning20Icon size={18} color={colors.cautionText} />}
        <Text size={14} weight={600} lineHeight={18} style={styles.title}>{isPaused ? "Your live is paused for viewers" : "Check what's on camera"}</Text>
      </View>
      <Text size={13} lineHeight={18} color={colors.text}>
        {isPaused ? safety.hostReason ?? "Our safety team is reviewing your live." : safety.warningMessage ?? "Your live may break our community guidelines."}
      </Text>
      {isPaused ? (
        <View style={styles.actions}>
          <Text size={12} lineHeight={16} color={colors.textMuted} style={styles.title}>Viewers see a paused screen until a person reviews it.</Text>
          {safety.appealable ? (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: hasAppealed }}
              disabled={hasAppealed}
              onPress={onAppeal}
              hitSlop={8}
              style={[styles.appealButton, hasAppealed && styles.appealButtonDisabled]}
            >
              <Text size={13} weight={600} lineHeight={16} color={colors.onPrimary}>{hasAppealed ? "Appeal sent" : "Appeal"}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  banner: { marginHorizontal: 12, marginTop: 8, padding: 12, borderRadius: 12, gap: 6, borderWidth: 1 },
  paused: { backgroundColor: colors.errorTint, borderColor: colors.error },
  warning: { backgroundColor: colors.cautionTint, borderColor: colors.caution },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { flex: 1 },
  actions: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 2 },
  appealButton: { paddingHorizontal: 14, minHeight: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySolid },
  appealButtonDisabled: { opacity: 0.6 },
}));
