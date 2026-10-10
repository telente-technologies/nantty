import { useNavigation, type NavigationProp } from "@react-navigation/native";
import { Pressable, StyleSheet, View } from "react-native";

import { ExpandableText, CLIP_CAPTION_WORD_LIMIT } from "@/components/ui/expandableText";
import { AiGeneratedLabel } from "@/components/feed/aiGeneratedLabel";
import { SponsoredCallToAction, SponsoredLabel } from "@/components/feed/sponsoredContent";
import { Group1234Icon } from "@/components/icons";
import { FriendsLikedAvatarStack } from "@/components/feed/friendsLikedAvatarStack";
import { VerificationBadge } from "@/components/profile/verificationBadge";
import { ClipSoundRow } from "@/components/sounds/clipSoundRow";
import { openSoundScreen } from "@/components/sounds/soundNavigation.util";
import { CopyrightCountdownBanner } from "@/components/accountHealth/copyrightCountdownBanner";
import { Avatar } from "@/components/ui/avatar";
import { Text } from "@/components/ui/text";
import type { MainStackParamList } from "@/navigation/navigation.types";
import { useAuthStore } from "@/store/auth.store";
import type { Clip } from "@/types";

import { ClipTaggedPill } from "@/components/taggedPeople/clipTaggedPill";

import { FollowPill } from "./followPill";
import { ReplyingToCommentLink } from "./videoReply/commentStickerOverlay";

export interface ClipDetailsProps {
  readonly clip: Clip;
  readonly isFollowing: boolean;
  readonly onToggleFollow: () => void;
  readonly onPressAuthor: () => void;
  readonly foregroundColor?: string;
  readonly isActive?: boolean;
  readonly onOpenTaggedPeople?: () => void;
}

export function ClipDetails({ clip, isFollowing, onToggleFollow, onPressAuthor, foregroundColor, isActive = true, onOpenTaggedPeople }: ClipDetailsProps) {
  const navigation = useNavigation<NavigationProp<MainStackParamList>>();
  const isViewerTheAuthor = useAuthStore((state) => state.user?.id === clip.author.id);
  const readableTextStyle = foregroundColor ? styles.readableOnVideo : undefined;
  return (
    <View style={styles.root}>
      {clip.friendsLiked ? (
        <View style={styles.likedBy}>
          <FriendsLikedAvatarStack avatarUrls={clip.friendsLiked.avatars} avatarSize={14} overlapOffset={10} fallbackIcon={<Group1234Icon />} />
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
      {clip.replyToComment ? <ReplyingToCommentLink clip={clip} foregroundColor={foregroundColor} /> : null}
      {clip.isAiGenerated ? <AiGeneratedLabel onVideo /> : null}
      {onOpenTaggedPeople ? <ClipTaggedPill post={clip} onPress={onOpenTaggedPeople} /> : null}
      <ExpandableText text={clip.text} mentions={clip.mentions} wordLimit={CLIP_CAPTION_WORD_LIMIT} size={13} lineHeight={16.9} color={foregroundColor} mentionColor={foregroundColor} style={readableTextStyle} expandOnTextPress />
      {clip.sound ? (
        <ClipSoundRow
          sound={clip.sound}
          isActive={isActive}
          foregroundColor={foregroundColor}
          onPress={() => openSoundScreen(navigation, clip.sound.id)}
        />
      ) : null}
      {clip.sound?.status === "under_copyright_review" ? (
        <Text size={11} lineHeight={15.4} letterSpacing={0} color={foregroundColor} style={readableTextStyle}>
          This sound is unavailable while under copyright review
        </Text>
      ) : null}
      {isViewerTheAuthor ? <CopyrightCountdownBanner contentId={clip.id} onOpenAccountStatus={() => navigation.navigate("AccountStatus")} /> : null}
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
