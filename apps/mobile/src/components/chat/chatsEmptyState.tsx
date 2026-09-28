import { StyleSheet, View } from "react-native";

import { ChatsCircle48Icon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";

export function ChatsEmptyState() {
  return (
    <View style={styles.root}>
      <ChatsCircle48Icon />
      <View style={styles.copy}>
        <Text size={16} weight={500} lineHeight={19.2} align="center">
          No Messages yet
        </Text>
        <Text size={13} lineHeight={16.9} color={colors.textSubtle} align="center">
          Once you send or receive a message, they&apos;ll show up here.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", gap: 24, paddingHorizontal: 53, paddingBottom: 120 },
  copy: { gap: 12, alignItems: "center" },
});
