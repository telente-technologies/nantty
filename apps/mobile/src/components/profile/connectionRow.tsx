import { Pressable, StyleSheet, View } from "react-native";

import { DotsThreeVertical24Icon } from "@/components/icons";
import { Avatar } from "@/components/ui/avatar";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import type { UserSummary } from "@/types";

export interface ConnectionRowProps {
  readonly user: UserSummary;
  readonly actionLabel?: string;
  readonly actionHighlighted?: boolean;
  readonly onPressAction?: () => void;
  readonly onPressUser?: () => void;
  readonly onPressMore?: () => void;
}

export function ConnectionRow({ user, actionLabel, actionHighlighted, onPressAction, onPressUser, onPressMore }: ConnectionRowProps) {
  return (
    <View style={styles.row}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${user.name}, @${user.username}`} onPress={onPressUser} style={styles.identity}>
        <Avatar uri={user.avatarUrl} size={54} placeholderColor={colors.primaryTint} />
        <View style={styles.names}>
          <Text size={16} weight={500} lineHeight={19.2} numberOfLines={1}>
            {user.name}
          </Text>
          <Text size={14} weight={500} lineHeight={16.8} color={colors.textSubtle} numberOfLines={1}>
            @{user.username}
          </Text>
        </View>
      </Pressable>
      <View style={styles.actions}>
        {actionLabel ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${actionLabel} ${user.name}`}
            onPress={onPressAction}
            style={[styles.action, { backgroundColor: actionHighlighted ? colors.primary : colors.chip }]}
          >
            <Text size={13} weight={500} lineHeight={16.9} color={actionHighlighted ? colors.white : colors.text}>
              {actionLabel}
            </Text>
          </Pressable>
        ) : null}
        {onPressMore ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`More options for ${user.name}`} hitSlop={10} onPress={onPressMore}>
            <DotsThreeVertical24Icon />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { height: 54, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 20 },
  identity: { flex: 1, flexDirection: "row", alignItems: "center", gap: 22 },
  names: { flex: 1, gap: 4 },
  actions: { flexDirection: "row", alignItems: "center", gap: 8 },
  action: { height: 25, paddingHorizontal: 4, borderRadius: 4, justifyContent: "center" },
});
