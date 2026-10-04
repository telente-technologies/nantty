import { Keyboard, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";

export function KeyboardDoneButton() {
  const { colors } = useTheme();
  return (
    <Text size={14} weight={600} lineHeight={16.8} color={colors.link} accessibilityRole="button" accessibilityLabel="Done, hide the keyboard" suppressHighlighting onPress={() => Keyboard.dismiss()} style={doneStyles.hit}>
      Done
    </Text>
  );
}

export function KeyboardDoneBar({ visible }: { readonly visible: boolean }) {
  const styles = useStyles();
  if (!visible) return null;
  return (
    <View style={styles.bar}>
      <KeyboardDoneButton />
    </View>
  );
}

const doneStyles = StyleSheet.create({ hit: { paddingVertical: 12, paddingHorizontal: 4 } });

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  bar: { minHeight: 44, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: colors.divider, backgroundColor: colors.surface, flexDirection: "row", justifyContent: "flex-end", alignItems: "center" },
}));
