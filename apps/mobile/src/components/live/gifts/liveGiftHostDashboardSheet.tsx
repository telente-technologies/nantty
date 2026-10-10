import { ScrollView, StyleSheet, View } from "react-native";

import { Analytics24Icon, Gift24Icon, Trophy24Icon, Users24Icon } from "@/components/icons";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import type { LiveGiftGoal, LiveGiftSentEvent } from "@/types";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";
import { makeThemedStyles, useTheme } from "@/theme";

import { LiveGiftArtwork } from "./liveGiftArtwork";
import { useLiveGiftCatalog } from "./liveGiftCatalog.hook";
import { LiveGiftLeaderboardList } from "./liveGiftLeaderboardList";
import { useLiveGiftStreamStats } from "./liveGiftStats.hook";

export interface LiveGiftHostDashboardSheetProps {
  readonly liveId: string;
  readonly visible: boolean;
  readonly goal: LiveGiftGoal | null;
  readonly recentGifts: readonly LiveGiftSentEvent[];
  readonly onEditGoal: () => void;
  readonly onClose: () => void;
}

function StatTile({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.tile}>
      <Text size={18} weight={700} lineHeight={22}>
        {value}
      </Text>
      <Text size={12} lineHeight={15} color={colors.textMuted}>
        {label}
      </Text>
    </View>
  );
}

export function LiveGiftHostDashboardSheet(props: LiveGiftHostDashboardSheetProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const stats = useLiveGiftStreamStats(props.liveId, props.visible);
  const { giftsById } = useLiveGiftCatalog(props.visible);
  const earnings = stats.data?.estimatedEarnings;
  return (
    <BottomSheet visible={props.visible} onClose={props.onClose} title="Gifts on this live" floating>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.body}>
        <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.chip }}>
          <Analytics24Icon size={22} color={colors.textMuted} />
        </View>
        <View style={styles.tiles}>
          <StatTile label="Gifts" value={(stats.data?.giftCount ?? 0).toLocaleString("en-US")} />
          <StatTile label="Coins received" value={(stats.data?.totalCoins ?? 0).toLocaleString("en-US")} />
          <StatTile label="Your earnings" value={earnings ? formatMoneyForDisplay(earnings, { showDecimals: false }) : "—"} />
        </View>
        <View style={styles.section}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Trophy24Icon size={20} color={colors.textMuted} />
            <Text size={14} weight={600} lineHeight={18}>
              Gift goal
            </Text>
          </View>
          <Text size={13} lineHeight={18} color={colors.textMuted}>
            {props.goal ? `${props.goal.title}: ${props.goal.progressCoins.toLocaleString("en-US")} of ${props.goal.targetCoins.toLocaleString("en-US")} coins${props.goal.status === "completed" ? " (reached)" : ""}` : "No goal yet."}
          </Text>
          <Button title={props.goal?.status === "active" ? "Edit goal" : "Set a new goal"} variant="outline" height={40} onPress={props.onEditGoal} />
        </View>
        <View style={styles.section}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Users24Icon size={20} color={colors.textMuted} />
            <Text size={14} weight={600} lineHeight={18}>
              Top supporters
            </Text>
          </View>
          <LiveGiftLeaderboardList entries={stats.data?.topSupporters ?? []} emptyMessage="Your supporters will show up here." />
        </View>
        <View style={styles.section}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Gift24Icon size={20} color={colors.textMuted} />
            <Text size={14} weight={600} lineHeight={18}>
              Recent gifts
            </Text>
          </View>
          {props.recentGifts.length === 0 ? (
            <Text size={13} lineHeight={18} color={colors.textMuted}>
              No gifts yet.
            </Text>
          ) : null}
          {props.recentGifts.map((event) => (
            <View key={event.giftTransactionId} style={styles.recentRow}>
              <LiveGiftArtwork assetKey={event.animationAssetKey} size={24} />
              <Text size={13} lineHeight={18} numberOfLines={1} style={styles.recentText}>
                {event.sender.name} sent {giftsById.get(event.giftId)?.name ?? "a gift"}
                {event.comboCount > 1 ? ` ×${event.comboCount}` : ""}
              </Text>
              <Text size={12} lineHeight={16} color={colors.textMuted}>
                {event.totalCoins.toLocaleString("en-US")}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </BottomSheet>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  scroll: { maxHeight: 560 },
  body: { paddingHorizontal: 16, paddingBottom: 24, gap: 18 },
  tiles: { flexDirection: "row", gap: 8 },
  tile: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: colors.background, gap: 2 },
  section: { gap: 10 },
  recentRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  recentText: { flex: 1 },
}));
