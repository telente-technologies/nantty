import { Pressable, StyleSheet, View } from "react-native";

import { Avatar } from "@/components/ui/avatar";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import type { UserSummary } from "@/types";

export interface ConversationIntroProps {
  readonly peer: UserSummary;
  readonly isFriend: boolean;
  readonly onPressViewProfile: () => void;
}

export function ConversationIntro({ peer, isFriend, onPressViewProfile }: ConversationIntroProps) {
  const firstName = peer.name.split(" ")[0];
  return (
    <View style={styles.root}>
      <View style={styles.identity}>
        <Avatar uri={peer.avatarUrl} size={64} placeholderColor={colors.placeholder} />
        <Text size={18} weight={500} lineHeight={21.6} letterSpacing={-0.36}>
          {peer.name}
        </Text>
      </View>
      {isFriend ? null : (
        <Text size={11} weight={500} lineHeight={15.4} letterSpacing={0} color={colors.textMuted} style={styles.notFriends}>
          You and <Text size={11} weight={500} lineHeight={15.4} letterSpacing={0}>{firstName}</Text> aren&apos;t friends yet
        </Text>
      )}
      <Pressable accessibilityRole="button" onPress={onPressViewProfile} style={styles.viewProfile}>
        <Text size={11} weight={500} lineHeight={15.4} letterSpacing={0}>
          View profile
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: "center", paddingTop: 24, paddingBottom: 16 },
  identity: { alignItems: "center", gap: 12 },
  notFriends: { marginTop: 8 },
  viewProfile: { marginTop: 14, height: 23, paddingHorizontal: 4, borderRadius: 4, backgroundColor: colors.chip, justifyContent: "center" },
});
