import { Pressable, StyleSheet, View } from "react-native";

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
        const selected = m === mode;
        return (
          <Pressable
            key={m}
            accessibilityRole="tab"
            accessibilityLabel={m.toUpperCase()}
            accessibilityState={{ selected }}
            hitSlop={{ top: 6, bottom: 6 }}
            onPress={() => onChangeMode(m)}
            style={[styles.modeItem, selected ? styles.modeItemSelected : null]}
          >
            <Text size={13} weight={selected ? 700 : 500} lineHeight={16.9} color={selected ? colors.onPrimary : colors.white}>
              {m.toUpperCase()}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  pill: {
    alignSelf: "center",
    height: 33,
    paddingHorizontal: 4,
    borderRadius: 999,
    backgroundColor: colors.black,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.16)",
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  modeItem: { height: 25, paddingHorizontal: 10, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  modeItemSelected: { backgroundColor: colors.primarySolid },
}));
