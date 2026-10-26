import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Crown24Icon, GlobeHemisphereWest24Icon, Trophy24Icon } from "@/components/icons";
import { Avatar } from "@/components/ui/avatar";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import type { LiveHostRanking } from "@/types";

import { describeHostRanking, formatRankChip, isUsableHostRanking, LIVE_HOST_RANK_TIER_COLORS, tierForRank } from "./liveHostRank.util";

export interface LiveHostRankAvatarProps {
  readonly avatarUrl: string | null | undefined;
  readonly hostName: string;
  readonly ranking: LiveHostRanking | null | undefined;
  readonly categoryLabel: string | null;
  readonly size?: number;
}

const RING_WIDTH = 2;
const RING_GAP = 1.5;

export function LiveHostRankAvatar({ avatarUrl, hostName, ranking, categoryLabel, size = 32 }: LiveHostRankAvatarProps) {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  if (!isUsableHostRanking(ranking)) return <Avatar uri={avatarUrl} size={size} />;
  const tier = LIVE_HOST_RANK_TIER_COLORS[tierForRank(ranking.globalRank)];
  const description = describeHostRanking(ranking, categoryLabel);
  const innerSize = size - (RING_WIDTH + RING_GAP) * 2;
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${hostName} is ${description.accessibilityLabel}. Show ranking`}
        hitSlop={4}
        onPress={() => setIsSheetOpen(true)}
        style={[styles.ring, { width: size, height: size, borderRadius: size / 2, borderColor: tier.ring }]}
      >
        <Avatar uri={avatarUrl} size={innerSize} />
        <View pointerEvents="none" style={[styles.chip, { backgroundColor: tier.chip }]}>
          <Text size={8} weight={700} lineHeight={10} color={tier.chipInk} numberOfLines={1}>
            {formatRankChip(ranking.globalRank)}
          </Text>
        </View>
      </Pressable>
      {isSheetOpen ? (
        <BottomSheet visible onClose={() => setIsSheetOpen(false)} title={`${hostName}'s ranking`} floating>
          <LiveHostRankingDetails ranking={ranking} globalLine={description.globalLine} categoryLine={description.categoryLine} ringColor={tier.ring} />
        </BottomSheet>
      ) : null}
    </>
  );
}

function LiveHostRankingDetails({ ranking, globalLine, categoryLine, ringColor }: { ranking: LiveHostRanking; globalLine: string; categoryLine: string | null; ringColor: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.sheetBody}>
      <View style={styles.sheetRow}>
        <View style={[styles.sheetIcon, { backgroundColor: colors.chip }]}>
          {ranking.globalRank <= 3 ? <Crown24Icon size={20} color={ringColor} /> : <GlobeHemisphereWest24Icon size={20} color={colors.textMuted} />}
        </View>
        <Text size={15} weight={600} lineHeight={20}>
          {globalLine}
        </Text>
      </View>
      {categoryLine ? (
        <View style={styles.sheetRow}>
          <View style={[styles.sheetIcon, { backgroundColor: colors.chip }]}>
            <Trophy24Icon size={20} color={colors.textMuted} />
          </View>
          <Text size={15} weight={600} lineHeight={20}>
            {categoryLine}
          </Text>
        </View>
      ) : null}
      <Text size={12} lineHeight={16} color={colors.textMuted}>
        Streamer rank from Nantty Points earned on lives.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { borderWidth: RING_WIDTH, alignItems: "center", justifyContent: "center" },
  chip: { position: "absolute", bottom: -6, alignSelf: "center", minWidth: 20, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 6, alignItems: "center" },
  sheetBody: { paddingHorizontal: 16, paddingBottom: 20, gap: 14 },
  sheetRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  sheetIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
});
