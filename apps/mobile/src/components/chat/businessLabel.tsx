import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";

export function BusinessLabel() {
  return (
    <View style={styles.label} accessibilityLabel="Business account">
      <Text size={10} weight={600} lineHeight={12} letterSpacing={0} color={colors.primary}>
        Business
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { paddingHorizontal: 6, height: 16, borderRadius: 4, backgroundColor: colors.primaryTint, justifyContent: "center" },
});
