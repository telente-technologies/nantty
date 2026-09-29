import { Pressable, StyleSheet, View } from "react-native";

import { ArrowLeft24Icon, DotsThreeVertical24Icon, Eye16Icon } from "@/components/icons";
import { FollowPill } from "@/components/clips/followPill";
import { VerificationBadge } from "@/components/profile/verificationBadge";
import { Avatar } from "@/components/ui/avatar";
import { useOpenUserProfile } from "@/hooks/useOpenUserProfile.hook";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import type { LiveSessionDetails } from "@/types";

export interface LiveHeaderProps {
  readonly session: LiveSessionDetails;
  readonly showTitle: boolean;
  readonly isFollowingHost: boolean;
  readonly isHost: boolean;
  readonly isShownOverVideo: boolean;
  readonly onBack: () => void;
  readonly onToggleFollow: () => void;
  readonly onMore: () => void;
}

function HostCounts({ followers, following, textColor }: { followers: number; following: number; textColor: string }) {
  return (
    <View style={styles.counts}>
      {[followers, following].map((count, i) => (
        <View key={i} style={styles.count}>
          <View style={styles.countDot} />
          <Text size={11} weight={500} lineHeight={15.4} letterSpacing={0} color={textColor}>
            {count}
          </Text>
        </View>
      ))}
    </View>
  );
}

function LiveViewerCountBadge({ viewers }: { viewers: number }) {
  return (
    <View style={styles.viewerBadge} accessibilityLabel={`Live, ${viewers} watching`}>
      <View style={styles.liveTag}>
        <Text size={11} weight={500} lineHeight={15.4} letterSpacing={-0.22} color={colors.white}>
          LIVE
        </Text>
      </View>
      <View style={styles.viewerCount}>
        <Eye16Icon />
        <Text size={12} weight={500} lineHeight={14.4} letterSpacing={-0.24}>
          {viewers}
        </Text>
      </View>
    </View>
  );
}

export function LiveHeader(props: LiveHeaderProps) {
  const openUserProfile = useOpenUserProfile();
  const { session } = props;
  const foregroundColor = props.isShownOverVideo ? colors.white : colors.text;
  const readableTextStyle = props.isShownOverVideo ? styles.readableOnVideo : undefined;
  return (
    <View style={styles.bar}>
      <View style={styles.left}>
        <Pressable accessibilityRole="button" accessibilityLabel="Leave live" hitSlop={12} onPress={props.onBack}>
          <ArrowLeft24Icon color={foregroundColor} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`${session.host.name}'s profile`} onPress={() => openUserProfile(session.host.id)} style={styles.host}>
          <Avatar uri={session.host.avatarUrl} size={32} />
          <View style={styles.hostText}>
            <View style={styles.hostNameRow}>
              <Text
                size={props.showTitle ? 13 : 11}
                weight={500}
                lineHeight={props.showTitle ? 16.9 : 15.4}
                letterSpacing={props.showTitle ? undefined : 0}
                numberOfLines={1}
                color={foregroundColor}
                style={readableTextStyle}
              >
                {session.host.name}
              </Text>
              <VerificationBadge verification={session.host.verification} legacyVerified={session.host.verified} size={12} />
            </View>
            {props.showTitle ? (
              <Text size={12} lineHeight={16.8} numberOfLines={1} color={foregroundColor} style={readableTextStyle}>
                {session.title}
              </Text>
            ) : (
              <HostCounts followers={session.host.followers} following={session.host.following} textColor={foregroundColor} />
            )}
          </View>
        </Pressable>
      </View>
      <View style={styles.right}>
        {props.showTitle ? <LiveViewerCountBadge viewers={session.viewers} /> : null}
        {!props.showTitle && !props.isHost && !props.isFollowingHost ? (
          <FollowPill large isFollowing={false} onPress={props.onToggleFollow} />
        ) : null}
        <Pressable accessibilityRole="button" accessibilityLabel="Live options" hitSlop={10} onPress={props.onMore}>
          <DotsThreeVertical24Icon color={foregroundColor} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hostNameRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  bar: { height: 48, paddingHorizontal: 16, paddingVertical: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  left: { flexDirection: "row", alignItems: "center", gap: 12, flexShrink: 1 },
  host: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1 },
  hostText: { flexShrink: 1 },
  counts: { flexDirection: "row", gap: 4 },
  count: { flexDirection: "row", alignItems: "center", gap: 2 },
  countDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.avatar },
  right: { flexDirection: "row", alignItems: "center", gap: 12 },
  viewerBadge: { height: 27, padding: 4, borderRadius: 4, backgroundColor: colors.placeholder, flexDirection: "row", alignItems: "center", gap: 4 },
  liveTag: { height: 19, paddingHorizontal: 4, borderRadius: 2, backgroundColor: colors.error, justifyContent: "center" },
  viewerCount: { flexDirection: "row", alignItems: "center", gap: 2 },
  readableOnVideo: { textShadowColor: "rgba(0,0,0,0.45)", textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 } },
});
