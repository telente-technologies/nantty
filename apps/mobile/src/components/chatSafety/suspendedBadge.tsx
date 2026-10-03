import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";

export function SuspendedBadge() {
  const { colors } = useTheme();
  return (
    <View style={[styles.badge, { backgroundColor: colors.errorTint }]} accessibilityLabel="This account is suspended">
      <Text size={10} weight={600} lineHeight={12} color={colors.error}>Suspended</Text>
    </View>
  );
}

const styles = StyleSheet.create({ badge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 } });
