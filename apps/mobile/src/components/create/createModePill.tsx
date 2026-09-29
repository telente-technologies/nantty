import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import type { CreateMode } from "@/types";

const MODES: readonly CreateMode[] = ["story", "post", "product", "live"];

export function CreateModePill({ mode, onChangeMode }: { mode: CreateMode; onChangeMode: (mode: CreateMode) => void }) {
  return (
    <View style={styles.pill} accessibilityRole="tablist">
      {MODES.map((m) => (
        <Text
          key={m}
          size={13}
          weight={500}
          lineHeight={16.9}
          color={m === mode ? colors.black : colors.textMuted}
          accessibilityRole="tab"
          accessibilityState={{ selected: m === mode }}
          onPress={() => onChangeMode(m)}
        >
          {m.toUpperCase()}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
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
});
