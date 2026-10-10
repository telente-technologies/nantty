import { ActivityIndicator, StyleSheet, View } from "react-native";

import { Trophy24Icon } from "@/components/icons";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";

import { LiveGiftLeaderboardList } from "./liveGiftLeaderboardList";
import { useLiveGiftLeaderboard } from "./liveGiftStats.hook";

export function LiveGiftLeaderboardSheet({ liveId, visible, onClose }: { liveId: string; visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const leaderboard = useLiveGiftLeaderboard(liveId, visible);
  const viewerRank = leaderboard.data?.viewerRank;
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Top supporters this live" floating>
      <View style={styles.body}>
        <View style={{ width: 40, height: 40, borderRadius: 20, alignSelf: "center", alignItems: "center", justifyContent: "center", backgroundColor: colors.chip }}>
          <Trophy24Icon size={22} color={colors.textMuted} />
        </View>
        {leaderboard.isPending ? <ActivityIndicator color={colors.primary} /> : null}
        <LiveGiftLeaderboardList entries={leaderboard.data?.data ?? []} emptyMessage="No points yet. Send a gift, like or share to top the ranking." />
        {viewerRank ? (
          <Text size={13} weight={600} lineHeight={18} color={colors.primary} align="center">
            You're #{viewerRank} on this live
          </Text>
        ) : null}
        <Text size={12} lineHeight={16} color={colors.textMuted} align="center">
          Ranked by ZudoPoints from gifts, likes, shares, follows and watch time.
        </Text>
      </View>
    </BottomSheet>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({ body: { paddingHorizontal: 16, paddingBottom: 20, gap: 14 } }));
