import { Pressable, StyleSheet } from "react-native";

import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";

export interface SmallTabProps {
  readonly label: string;
  readonly selected?: boolean;
  readonly onPress?: () => void;
}

export function SmallTab({ label, selected = false, onPress }: SmallTabProps) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.tab, { backgroundColor: selected ? colors.chip : colors.white }]}
    >
      <Text size={11} weight={500} lineHeight={15.4} letterSpacing={0} color={selected ? colors.black : colors.textMuted}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tab: { height: 23, paddingHorizontal: 4, borderRadius: 4, justifyContent: "center" },
});
