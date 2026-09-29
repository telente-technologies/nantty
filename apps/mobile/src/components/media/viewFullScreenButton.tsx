import { Pressable, StyleSheet } from "react-native";

import { ArrowsOutSimple24Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";

export function ViewFullScreenButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="View full screen" onPress={onPress} style={styles.button}>
      <ArrowsOutSimple24Icon size={16} color={colors.white} />
      <Text size={13} weight={500} lineHeight={16.9} color={colors.white}>
        View full screen
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
    backgroundColor: colors.overlay,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
});
