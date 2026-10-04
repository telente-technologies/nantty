import { Pressable, StyleSheet, View } from "react-native";

import { SealCheck20Icon } from "@/components/icons";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { FollowSuggestion } from "@/types/explore.type";

export interface FollowSuggestionRowProps {
  readonly suggestion: FollowSuggestion;
  readonly following: boolean;
  readonly onPressProfile: () => void;
  readonly onToggleFollow: () => void;
}

export function FollowSuggestionRow({ suggestion, following, onPressProfile, onToggleFollow }: FollowSuggestionRowProps) {
  const { colors } = useTheme();
  const themed = useStyles();
  const { user } = suggestion;
  return (
    <View style={styles.row}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Open ${user.name}'s profile`} onPress={onPressProfile} style={styles.identity}>
        <Avatar uri={user.avatarUrl} size={44} placeholderColor={colors.primaryTint} />
        <View style={styles.text}>
          <View style={styles.nameRow}>
            <Text size={14} weight={600} numberOfLines={1} style={styles.name}>{user.name}</Text>
            {user.verified || suggestion.checkmarkTier !== "none" ? <SealCheck20Icon size={16} /> : null}
            {suggestion.isOfficial ? <View style={themed.officialBadge}><Text size={10} weight={600} color={colors.text}>Official</Text></View> : null}
          </View>
          <Text size={12} color={colors.textSubtle} numberOfLines={1}>@{user.username}</Text>
          <Text size={12} color={colors.textMuted} numberOfLines={1}>{suggestion.reason.label}</Text>
        </View>
      </Pressable>
      <Button title={following ? "Following" : "Follow"} variant={following ? "outline" : "primary"} height={34} onPress={onToggleFollow} accessibilityLabel={`${following ? "Unfollow" : "Follow"} ${user.name}`} />
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  officialBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, backgroundColor: colors.chip },
}));

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 8 },
  identity: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  text: { flex: 1, gap: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  name: { flexShrink: 1 },
});
