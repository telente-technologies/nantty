import { Pressable, StyleSheet, View } from "react-native";

import { Group1234Icon } from "@/components/icons";
import { Avatar } from "@/components/ui/avatar";
import { Text } from "@/components/ui/text";
import type { Clip } from "@/types";

import { FollowPill } from "./followPill";

export interface ClipDetailsProps {
  readonly clip: Clip;
  readonly isFollowing: boolean;
  readonly onToggleFollow: () => void;
  readonly onPressAuthor: () => void;
}

export function ClipDetails({ clip, isFollowing, onToggleFollow, onPressAuthor }: ClipDetailsProps) {
  return (
    <View style={styles.root}>
      {clip.friendsLiked ? (
        <View style={styles.likedBy}>
          <Group1234Icon />
          <Text size={11} weight={500} lineHeight={15.4} letterSpacing={0}>
            {clip.friendsLiked.count} friends liked this
          </Text>
        </View>
      ) : null}
      <View style={styles.authorRow}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${clip.author.name}'s profile`} onPress={onPressAuthor} style={styles.author}>
          <Avatar uri={clip.author.avatarUrl} size={32} />
          <View>
            <Text size={14} weight={500} lineHeight={16.8}>
              {clip.author.name}
            </Text>
            <Text size={12} lineHeight={16.8}>
              @{clip.author.username}
            </Text>
          </View>
        </Pressable>
        <FollowPill isFollowing={isFollowing} onPress={onToggleFollow} />
      </View>
      <Text size={13} lineHeight={16.9} numberOfLines={2}>
        {clip.text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: 269, gap: 8 },
  likedBy: { flexDirection: "row", alignItems: "center", gap: 4 },
  authorRow: { height: 34, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  author: { flexDirection: "row", alignItems: "center", gap: 9 },
});
