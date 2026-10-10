import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { FlatList, ScrollView, StyleSheet } from "react-native";

import { RankingRow } from "@/components/rankings/rankingRow";
import { Chip } from "@/components/ui/chip";
import { ErrorState } from "@/components/ui/errorState";
import { Header } from "@/components/ui/header";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import { pointsService } from "@/services/social/points.service";
import { useLocaleStore } from "@/store/locale.store";
import type { RankingBoard, RankingScope } from "@/types/socialGraph.type";

const SCOPES: readonly { key: RankingScope; label: string }[] = [
  { key: "global", label: "Global" },
  { key: "country", label: "Country" },
  { key: "category", label: "Category" },
];

const BOARDS: readonly { key: RankingBoard; label: string }[] = [
  { key: "streamer", label: "Streamers" },
  { key: "supporter", label: "Supporters" },
  { key: "creator", label: "Creators" },
];

const CATEGORIES = [
  { id: "justChatting", label: "Just chatting" },
  { id: "gaming", label: "Gaming" },
  { id: "music", label: "Music" },
  { id: "irl", label: "IRL" },
  { id: "education", label: "Education" },
  { id: "shopping", label: "Shopping" },
] as const;

export function RankingsScreen() {
  const { colors } = useTheme();
  const [scope, setScope] = useState<RankingScope>("global");
  const [board, setBoard] = useState<RankingBoard>("supporter");
  const [categoryId, setCategoryId] = useState<string>(CATEGORIES[0].id);
  const countryCode = useLocaleStore((state) => state.deviceRegionCode) ?? "NG";
  const rankings = useQuery({
    queryKey: ["rankings", board, scope, scope === "country" ? countryCode : scope === "category" ? categoryId : null],
    queryFn: () =>
      pointsService.fetchRankings({
        board,
        scope,
        period: "week",
        countryCode: scope === "country" ? countryCode : undefined,
        categoryId: scope === "category" ? categoryId : undefined,
      }),
  });

  return (
    <Screen>
      <Header title="Rankings" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipBar} accessibilityRole="tablist">
        {SCOPES.map((item) => (
          <Chip key={item.key} kind="filter" label={item.label} selected={scope === item.key} onPress={() => setScope(item.key)} />
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipBar} accessibilityRole="tablist">
        {BOARDS.map((item) => (
          <Chip key={item.key} kind="topic" label={item.label} selected={board === item.key} onPress={() => setBoard(item.key)} />
        ))}
      </ScrollView>
      {scope === "category" ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipBar}>
          {CATEGORIES.map((item) => (
            <Chip key={item.id} kind="filter" label={item.label} selected={categoryId === item.id} onPress={() => setCategoryId(item.id)} />
          ))}
        </ScrollView>
      ) : null}
      {rankings.isPending ? (
        <ListSkeleton />
      ) : rankings.isError ? (
        <ErrorState message="Couldn't load rankings." onRetry={() => rankings.refetch()} />
      ) : (
        <FlatList
          data={rankings.data.data}
          keyExtractor={(entry) => entry.user.id}
          renderItem={({ item }) => <RankingRow entry={item} />}
          contentContainerStyle={styles.list}
          ListFooterComponent={
            <Text size={11} lineHeight={14} color={colors.textMuted} align="center" style={styles.footer}>
              ZudoPoints are a ranking score only. They have no cash value.
            </Text>
          }
          ListEmptyComponent={<Text size={14} lineHeight={16.8} color={colors.textSubtle} align="center">No rankings yet</Text>}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chipBar: { flexGrow: 0 },
  chips: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  list: { paddingBottom: 40 },
  footer: { marginTop: 16, paddingHorizontal: 16 },
});
