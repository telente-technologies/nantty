import { Pressable, StyleSheet, View } from "react-native";

import { SealCheck20Icon } from "@/components/icons";
import { Avatar } from "@/components/ui/avatar";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";

export interface PersonRowProps {
  readonly name: string;
  readonly handle: string;
  readonly avatarUrl: string | null;
  readonly verified?: boolean;
  readonly onPress: () => void;
}

export function PersonRow({ name, handle, avatarUrl, verified, onPress }: PersonRowProps) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={name} onPress={onPress} style={styles.row}>
      <Avatar uri={avatarUrl} size={40} placeholderColor={colors.primaryTint} />
      <View style={styles.text}>
        <View style={styles.nameRow}>
          <Text size={14} weight={500} lineHeight={16.8}>{name}</Text>
          {verified ? <SealCheck20Icon size={16} /> : null}
        </View>
        <Text size={12} lineHeight={16.8} color={colors.textSubtle}>{handle}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 12 },
  text: { flex: 1, gap: 2 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
});
