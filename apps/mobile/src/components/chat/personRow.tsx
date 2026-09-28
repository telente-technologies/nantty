import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Avatar } from "@/components/ui/avatar";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import type { UserSummary } from "@/types";

export interface PersonRowProps {
  readonly person: UserSummary;
  readonly onPress?: () => void;
  readonly right?: ReactNode;
  readonly avatarSize?: number;
}

export function PersonRow({ person, onPress, right, avatarSize = 54 }: PersonRowProps) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={person.name} onPress={onPress} style={styles.row}>
      <Avatar uri={person.avatarUrl} size={avatarSize} placeholderColor={colors.primaryTint} />
      <View style={styles.text}>
        <Text size={16} weight={500} lineHeight={19.2} numberOfLines={1}>
          {person.name}
        </Text>
        <Text size={14} weight={500} lineHeight={16.8} color={colors.textSubtle} numberOfLines={1}>
          @{person.username}
        </Text>
      </View>
      {right}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 54, flexDirection: "row", alignItems: "center", gap: 20 },
  text: { flex: 1, gap: 4 },
});
