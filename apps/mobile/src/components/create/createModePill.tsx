import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { useCreatorStatus } from "@/hooks/useCreatorStatus.hook";
import type { CreateMode } from "@/types";

const MODES: readonly CreateMode[] = ["story", "post", "clip", "product", "live"];

export function CreateModePill({ mode, onChangeMode }: { mode: CreateMode; onChangeMode: (mode: CreateMode) => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { canGoLive, isCreatorStatusLoading } = useCreatorStatus();
  const isLiveModeLocked = !canGoLive && !isCreatorStatusLoading;
  return (
    <View style={styles.pill} accessibilityRole="tablist">
      {MODES.map((m) => {
        const isLockedMode = m === "live" && isLiveModeLocked;
        return (
          <View key={m} style={styles.modeItem}>
            <Text
              size={13}
              weight={500}
              lineHeight={16.9}
              color={m === mode ? colors.black : colors.textMuted}
              accessibilityRole="tab"
              accessibilityLabel={isLockedMode ? "LIVE, locked. Join the Creator Program to go live" : m.toUpperCase()}
              accessibilityState={{ selected: m === mode, disabled: isLockedMode }}
              onPress={() => onChangeMode(m)}
            >
              {m.toUpperCase()}
            </Text>
            {isLockedMode ? <View style={styles.lockedModeDot} /> : null}
          </View>
        );
      })}
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  pill: {
    alignSelf: "center",
    height: 33,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: colors.textSubtle,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  modeItem: { flexDirection: "row", alignItems: "center", gap: 3 },
  lockedModeDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.textMuted },
}));
