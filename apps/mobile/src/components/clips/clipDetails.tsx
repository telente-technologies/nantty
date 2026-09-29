import { Pressable, StyleSheet, View } from "react-native";

import { SponsoredCallToAction, SponsoredLabel } from "@/components/feed/sponsoredContent";
import { Group1234Icon } from "@/components/icons";
import { VerificationBadge } from "@/components/profile/verificationBadge";
import { Avatar } from "@/components/ui/avatar";
import { Text } from "@/components/ui/text";
import type { Clip } from "@/types";

import { FollowPill } from "./followPill";

export interface ClipDetailsProps {
  readonly clip: Clip;
  readonly isFollowing: boolean;
  readonly onToggleFollow: () => void;
  readonly onPressAuthor: () => void;
  readonly foregroundColor?: string;
}

export function ClipDetails({ clip, isFollowing, onToggleFollow, onPressAuthor, foregroundColor }: ClipDetailsProps) {
  const readableTextStyle = foregroundColor ? styles.readableOnVideo : undefined;
  return (
    <View style={styles.root}>
      {clip.friendsLiked ? (
        <View style={styles.likedBy}>
          <Group1234Icon />
          <Text size={11} weight={500} lineHeight={15.4} letterSpacing={0} color={foregroundColor} style={readableTextStyle}>
            {clip.friendsLiked.count} friends liked this
          </Text>
        </View>
      ) : null}
      <View style={styles.authorRow}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${clip.author.name}'s profile`} onPress={onPressAuthor} style={styles.author}>
          <Avatar uri={clip.author.avatarUrl} size={32} />
          <View>
            <View style={styles.nameRow}>
              <Text size={14} weight={500} lineHeight={16.8} color={foregroundColor} style={readableTextStyle}>
                {clip.author.name}
              </Text>
              <VerificationBadge verification={clip.author.verification} legacyVerified={clip.author.verified} size={16} />
              {clip.sponsored ? <SponsoredLabel sponsored={clip.sponsored} /> : null}
            </View>
            <Text size={12} lineHeight={16.8} color={foregroundColor} style={readableTextStyle}>
              @{clip.author.username}
            </Text>
          </View>
        </Pressable>
        <FollowPill isFollowing={isFollowing} onPress={onToggleFollow} />
      </View>
      <Text size={13} lineHeight={16.9} numberOfLines={2} color={foregroundColor} style={readableTextStyle}>
        {clip.text}
      </Text>
      {clip.sponsored ? <SponsoredCallToAction sponsored={clip.sponsored} placement="clips" itemId={clip.id} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: 269, gap: 8 },
  likedBy: { flexDirection: "row", alignItems: "center", gap: 4 },
  authorRow: { height: 34, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  author: { flexDirection: "row", alignItems: "center", gap: 9 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  readableOnVideo: { textShadowColor: "rgba(0,0,0,0.45)", textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 } },
});
