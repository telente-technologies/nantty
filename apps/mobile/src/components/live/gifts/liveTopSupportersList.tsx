import { StyleSheet, View } from "react-native";

import { ListSkeleton } from "@/components/ui/listSkeleton";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";

import { LiveGiftLeaderboardList } from "./liveGiftLeaderboardList";
import { useLiveGiftLeaderboard } from "./liveGiftStats.hook";

const MAX_SUPPORTERS_SHOWN = 5;

export function LiveTopSupportersList({ liveId }: { liveId: string }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const leaderboard = useLiveGiftLeaderboard(liveId, true);
  if (leaderboard.isPending) return <ListSkeleton rows={3} avatarSize={32} padding={0} />;
  const entries = (leaderboard.data?.data ?? []).slice(0, MAX_SUPPORTERS_SHOWN);
  if (entries.length === 0) return null;
  return (
    <View style={styles.root}>
      <Text size={14} weight={600} lineHeight={18} accessibilityRole="header">
        Top Supporters
      </Text>
      <LiveGiftLeaderboardList entries={entries} emptyMessage="" />
      <Text size={11} lineHeight={14} color={colors.textMuted}>
        Ranked by Nantty Points.
      </Text>
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({ root: { alignSelf: "stretch", paddingHorizontal: 24, gap: 10 } }));
