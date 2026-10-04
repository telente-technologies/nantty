import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { useCreateMenuAccess } from "@/hooks/useCreateMenuAccess.hook";
import type { CreateMode } from "@/types";

export function CreateModePill({ mode, onChangeMode }: { mode: CreateMode; onChangeMode: (mode: CreateMode) => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { availableModes } = useCreateMenuAccess();
  return (
    <View style={styles.pill} accessibilityRole="tablist">
      {availableModes.map((m) => {
        return (
          <View key={m} style={styles.modeItem}>
            <Text
              size={13}
              weight={500}
              lineHeight={16.9}
              color={m === mode ? colors.black : colors.textMuted}
              accessibilityRole="tab"
              accessibilityLabel={m.toUpperCase()}
              accessibilityState={{ selected: m === mode }}
              onPress={() => onChangeMode(m)}
            >
              {m.toUpperCase()}
            </Text>
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
}));
