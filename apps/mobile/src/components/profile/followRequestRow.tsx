import { Pressable, StyleSheet, View } from "react-native";

import { Avatar } from "@/components/ui/avatar";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { FollowRequest } from "@/types/socialGraph.type";

export interface FollowRequestRowProps {
  readonly request: FollowRequest;
  readonly onConfirm: () => void;
  readonly onDelete: () => void;
  readonly onPressUser: () => void;
}

export function FollowRequestRow({ request, onConfirm, onDelete, onPressUser }: FollowRequestRowProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { requester } = request;
  return (
    <View style={styles.row}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${requester.name}, @${requester.username}`} onPress={onPressUser} style={styles.identity}>
        <Avatar uri={requester.avatarUrl} size={48} />
        <View style={styles.names}>
          <Text size={15} weight={500} lineHeight={18} numberOfLines={1}>{requester.name}</Text>
          <Text size={13} lineHeight={16} color={colors.textSubtle} numberOfLines={1}>@{requester.username}</Text>
        </View>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`Confirm ${requester.name}'s follow request`} onPress={onConfirm} style={[styles.button, styles.confirm]}>
        <Text size={13} weight={500} lineHeight={16.9} color={colors.white}>Confirm</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${requester.name}'s follow request`} onPress={onDelete} style={[styles.button, styles.delete]}>
        <Text size={13} weight={500} lineHeight={16.9}>Delete</Text>
      </Pressable>
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  row: { paddingHorizontal: 16, minHeight: 64, flexDirection: "row", alignItems: "center", gap: 8 },
  identity: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  names: { flex: 1, gap: 2 },
  button: { height: 30, paddingHorizontal: 10, borderRadius: 4, justifyContent: "center" },
  confirm: { backgroundColor: colors.primarySolid },
  delete: { backgroundColor: colors.chip },
}));
