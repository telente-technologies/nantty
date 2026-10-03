import { Pressable, StyleSheet, View } from "react-native";

import { Avatar } from "@/components/ui/avatar";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import type { FollowRequest } from "@/types/socialGraph.type";

export interface FollowRequestRowProps {
  readonly request: FollowRequest;
  readonly disabled: boolean;
  readonly onApprove: () => void;
  readonly onDecline: () => void;
  readonly onPressUser: () => void;
}

export function FollowRequestRow({ request, disabled, onApprove, onDecline, onPressUser }: FollowRequestRowProps) {
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
      <Pressable accessibilityRole="button" accessibilityLabel={`Approve ${requester.name}`} disabled={disabled} onPress={onApprove} style={[styles.button, styles.approve]}>
        <Text size={13} weight={500} lineHeight={16.9} color={colors.white}>Approve</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`Decline ${requester.name}`} disabled={disabled} onPress={onDecline} style={[styles.button, styles.decline]}>
        <Text size={13} weight={500} lineHeight={16.9}>Decline</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 16, minHeight: 64, flexDirection: "row", alignItems: "center", gap: 8 },
  identity: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  names: { flex: 1, gap: 2 },
  button: { height: 30, paddingHorizontal: 10, borderRadius: 4, justifyContent: "center" },
  approve: { backgroundColor: colors.primary },
  decline: { backgroundColor: colors.chip },
});
