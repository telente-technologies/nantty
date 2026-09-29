import { Pressable, StyleSheet, View } from "react-native";

import { ArrowLeft24Icon, DotsThreeVertical24Icon } from "@/components/icons";
import { FollowPill } from "@/components/clips/followPill";
import { Avatar } from "@/components/ui/avatar";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import type { LiveSessionDetails } from "@/types";

import { LiveBadge } from "./liveBadge";

export interface LiveHeaderProps {
  readonly session: LiveSessionDetails;
  readonly showTitle: boolean;
  readonly isFollowingHost: boolean;
  readonly isHost: boolean;
  readonly onBack: () => void;
  readonly onToggleFollow: () => void;
  readonly onMore: () => void;
}

function HostCounts({ followers, following }: { followers: number; following: number }) {
  return (
    <View style={styles.counts}>
      {[followers, following].map((count, i) => (
        <View key={i} style={styles.count}>
          <View style={styles.countDot} />
          <Text size={11} weight={500} lineHeight={15.4} letterSpacing={0}>
            {count}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function LiveHeader(props: LiveHeaderProps) {
  const { session } = props;
  return (
    <View style={styles.bar}>
      <View style={styles.left}>
        <Pressable accessibilityRole="button" accessibilityLabel="Leave live" hitSlop={12} onPress={props.onBack}>
          <ArrowLeft24Icon />
        </Pressable>
        <View style={styles.host}>
          <Avatar uri={session.host.avatarUrl} size={32} />
          <View style={styles.hostText}>
            <Text size={11} weight={500} lineHeight={15.4} letterSpacing={0} numberOfLines={1}>
              {session.host.name}
            </Text>
            {props.showTitle ? (
              <Text size={11} weight={500} lineHeight={15.4} letterSpacing={0} numberOfLines={1}>
                {session.title}
              </Text>
            ) : (
              <HostCounts followers={session.host.followers} following={session.host.following} />
            )}
          </View>
        </View>
      </View>
      <View style={styles.right}>
        {props.showTitle ? <LiveBadge viewers={session.viewers} /> : null}
        {!props.showTitle && !props.isHost && !props.isFollowingHost ? (
          <FollowPill large isFollowing={false} onPress={props.onToggleFollow} />
        ) : null}
        <Pressable accessibilityRole="button" accessibilityLabel="Live options" hitSlop={10} onPress={props.onMore}>
          <DotsThreeVertical24Icon />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { height: 32, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  left: { flexDirection: "row", alignItems: "center", gap: 12, flexShrink: 1 },
  host: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1 },
  hostText: { gap: 2, flexShrink: 1 },
  counts: { flexDirection: "row", gap: 4 },
  count: { flexDirection: "row", alignItems: "center", gap: 2 },
  countDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.avatar },
  right: { flexDirection: "row", alignItems: "center", gap: 8 },
});
