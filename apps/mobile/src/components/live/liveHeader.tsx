import { Pressable, StyleSheet, View } from "react-native";

import { ArrowLeft24Icon, DotsThreeVertical24Icon, Eye16Icon } from "@/components/icons";
import { FollowPill } from "@/components/clips/followPill";
import { VerificationBadge } from "@/components/profile/verificationBadge";
import { useOpenUserProfile } from "@/hooks/useOpenUserProfile.hook";
import { Text } from "@/components/ui/text";
import type { LiveCategory, LiveSessionDetails } from "@/types";

import { LiveHostRankAvatar } from "./ranking/liveHostRankAvatar";
import { liveAccent, useLiveForeground, type LiveForeground } from "./liveSurface.constant";

export interface LiveHeaderProps {
  readonly session: LiveSessionDetails;
  readonly showTitle: boolean;
  readonly isFollowingHost: boolean;
  readonly isHost: boolean;
  readonly isShownOverVideo: boolean;
  readonly onBack: () => void;
  readonly onToggleFollow: () => void;
  readonly onMore: () => void;
  readonly onHostLongPress?: () => void;
}

function HostCounts({ followers, foreground }: { followers: number; foreground: LiveForeground }) {
  return (
    <Text size={11} weight={500} lineHeight={15} color={foreground.inkMuted} style={foreground.textShadow} numberOfLines={1}>
      {Intl.NumberFormat("en", { notation: "compact" }).format(followers)} followers
    </Text>
  );
}

function LiveViewerCountBadge({ viewers, foreground }: { viewers: number; foreground: LiveForeground }) {
  return (
    <View style={[styles.viewerBadge, { backgroundColor: foreground.chip, borderColor: foreground.chipBorder }]} accessibilityLabel={`Live, ${viewers} watching`}>
      <View style={styles.liveTag}>
        <Text size={11} weight={700} lineHeight={14} letterSpacing={0.4} color="#FFFFFF">
          LIVE
        </Text>
      </View>
      <View style={styles.viewerCount}>
        <Eye16Icon color={foreground.ink} />
        <Text size={12} weight={600} lineHeight={15} color={foreground.ink}>
          {viewers}
        </Text>
      </View>
    </View>
  );
}

export const LIVE_CATEGORY_LABELS: Record<LiveCategory, string> = {
  justChatting: "Just chatting",
  gaming: "Gaming",
  music: "Music",
  irl: "IRL",
  education: "Learning",
  shopping: "Shopping",
};

export function LiveHeader(props: LiveHeaderProps) {
  const openUserProfile = useOpenUserProfile();
  const foreground = useLiveForeground(props.isShownOverVideo);
  const { session } = props;
  return (
    <View style={styles.bar}>
      <View style={styles.left}>
        <Pressable accessibilityRole="button" accessibilityLabel="Leave live" hitSlop={12} onPress={props.onBack} style={[styles.iconButton, { backgroundColor: foreground.chip }]}>
          <ArrowLeft24Icon size={20} color={foreground.ink} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${session.host.name}'s profile`}
          onPress={() => openUserProfile(session.host.id)}
          onLongPress={props.onHostLongPress}
          style={[styles.host, { backgroundColor: foreground.chip, borderColor: foreground.chipBorder }]}
        >
          <LiveHostRankAvatar
            avatarUrl={session.host.avatarUrl}
            hostName={session.host.name}
            ranking={session.hostRanking}
            categoryLabel={session.hostRanking?.category ? (LIVE_CATEGORY_LABELS[session.hostRanking.category] ?? null) : null}
          />
          <View style={styles.hostText}>
            <View style={styles.hostNameRow}>
              <Text size={13} weight={600} lineHeight={17} numberOfLines={1} color={foreground.ink} style={[styles.shrink, foreground.textShadow]}>
                {session.host.name}
              </Text>
              <VerificationBadge verification={session.host.verification} legacyVerified={session.host.verified} size={12} />
            </View>
            {props.showTitle ? (
              <Text size={11} lineHeight={15} numberOfLines={1} color={foreground.inkMuted} style={foreground.textShadow}>
                {session.title}
              </Text>
            ) : (
              <HostCounts followers={session.host.followers} foreground={foreground} />
            )}
          </View>
          {!props.showTitle && !props.isHost && !props.isFollowingHost ? <FollowPill isFollowing={false} onPress={props.onToggleFollow} /> : null}
        </Pressable>
      </View>
      <View style={styles.right}>
        {session.category && session.category !== "justChatting" ? (
          <View style={[styles.categoryChip, { backgroundColor: foreground.chip, borderColor: foreground.chipBorder }]}>
            <Text size={11} weight={600} lineHeight={14} color={foreground.ink}>
              {LIVE_CATEGORY_LABELS[session.category]}
            </Text>
          </View>
        ) : null}
        {props.showTitle ? <LiveViewerCountBadge viewers={session.viewers} foreground={foreground} /> : null}
        <Pressable accessibilityRole="button" accessibilityLabel="Live options" hitSlop={10} onPress={props.onMore} style={[styles.iconButton, { backgroundColor: foreground.chip }]}>
          <DotsThreeVertical24Icon size={20} color={foreground.ink} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { minHeight: 52, paddingHorizontal: 12, paddingVertical: 6, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  left: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
  iconButton: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  host: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1, paddingLeft: 3, paddingRight: 10, paddingVertical: 3, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  hostText: { flexShrink: 1 },
  hostNameRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  shrink: { flexShrink: 1 },
  right: { flexDirection: "row", alignItems: "center", gap: 8 },
  categoryChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  viewerBadge: { height: 28, paddingLeft: 3, paddingRight: 8, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", gap: 6 },
  liveTag: { height: 22, paddingHorizontal: 7, borderRadius: 999, backgroundColor: liveAccent.red, justifyContent: "center" },
  viewerCount: { flexDirection: "row", alignItems: "center", gap: 3 },
});
