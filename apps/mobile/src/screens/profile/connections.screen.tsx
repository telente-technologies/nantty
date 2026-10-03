import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDeferredValue, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { ArrowLeft24Icon, DotsThreeVertical24Icon, MagnifyingGlass20Icon } from "@/components/icons";
import { ConnectionRow } from "@/components/profile/connectionRow";
import { followButtonLabelForState, isFollowStateHighlighted, resolveFollowStateOfUser } from "@/components/profile/followState.util";
import { profileQueryKeys } from "@/components/profile/profileQueries.hook";
import { Chip } from "@/components/ui/chip";
import { ErrorState } from "@/components/ui/errorState";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { TextField } from "@/components/ui/input";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import { ApiError } from "@/errors/api.error";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { followsService } from "@/services/follows.service";
import { useAuthStore } from "@/store/auth.store";
import type { ConnectionEntry, ConnectionTab } from "@/types/account.type";

const TABS: { key: ConnectionTab; label: string }[] = [
  { key: "followers", label: "Followers" },
  { key: "following", label: "Following" },
  { key: "shopped", label: "Shopped" },
  { key: "suggested", label: "Suggested" },
  { key: "blocked", label: "Blocked" },
];

export function ConnectionsScreen({ navigation, route }: MainScreenProps<"Connections">) {
  const { userId } = route.params;
  const [tab, setTab] = useState<ConnectionTab>(route.params.tab ?? "followers");
  const [search, setSearch] = useState("");
  const isMyConnections = useAuthStore((s) => s.user?.id) === userId;
  const visibleTabs = isMyConnections ? TABS : TABS.filter((t) => t.key !== "blocked" && t.key !== "shopped");
  const queryClient = useQueryClient();
  const deferredSearch = useDeferredValue(search.trim());
  const isSearchableListTab = tab === "followers" || tab === "following";
  const { data: entries = [], isLoading, error, refetch } = useQuery({
    queryKey: [...profileQueryKeys.connections(userId, tab), isSearchableListTab ? deferredSearch : ""],
    queryFn: async () => {
      if (tab === "followers") return (await followsService.listFollowersOfUser(userId, deferredSearch)).data;
      if (tab === "following") return (await followsService.listFollowingOfUser(userId, deferredSearch)).data;
      return followsService.listConnectionsOfUser(userId, tab);
    },
    retry: (failureCount, failure) => !(failure instanceof ApiError && failure.status === 403) && failureCount < 2,
  });
  const isListHiddenBecausePrivate = error instanceof ApiError && error.status === 403;

  const changeRelationshipWithUser = useMutation({
    mutationFn: async (entry: ConnectionEntry) => {
      await (tab === "blocked"
        ? followsService.unblockUser(entry.id)
        : resolveFollowStateOfUser(entry) !== "none" && resolveFollowStateOfUser(entry) !== "rejected"
          ? followsService.unfollowUser(entry.id)
          : followsService.followUser(entry.id));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users", userId, "connections"] }),
  });

  const filteredEntries = isSearchableListTab
    ? entries
    : entries.filter((e) => !search.trim() || `${e.name} ${e.username}`.toLowerCase().includes(search.trim().toLowerCase()));

  const actionLabelFor = (entry: ConnectionEntry) => (tab === "blocked" ? "Unblock" : followButtonLabelForState(resolveFollowStateOfUser(entry)));

  return (
    <Screen background={colors.white}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" hitSlop={12} onPress={() => navigation.goBack()}>
          <ArrowLeft24Icon />
        </Pressable>
        <DotsThreeVertical24Icon />
      </View>
      <TextField
        placeholder="Search"
        value={search}
        onChangeText={setSearch}
        left={<MagnifyingGlass20Icon />}
        autoCapitalize="none"
        returnKeyType="search"
        accessibilityLabel="Search people"
        style={styles.search}
        boxStyle={styles.searchBox}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs} style={styles.tabsBar}>
        {visibleTabs.map((t) => (
          <Chip key={t.key} kind="filter" label={t.label} selected={t.key === tab} onPress={() => setTab(t.key)} />
        ))}
      </ScrollView>
      <Text size={14} weight={500} lineHeight={16.8} style={styles.sort}>
        Sort by Default
      </Text>
      {isListHiddenBecausePrivate ? (
        <ErrorState message="This account is private. Follow them to see their followers and following." />
      ) : error ? (
        <ErrorState message="Couldn't load this list." onRetry={() => refetch()} />
      ) : isLoading ? (
        <ListSkeleton />
      ) : null}
      <FlatList
        data={error || isLoading ? [] : filteredEntries}
        keyExtractor={(entry) => entry.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => (
          <ConnectionRow
            user={item}
            actionLabel={item.id === useAuthStore.getState().user?.id ? undefined : actionLabelFor(item)}
            actionHighlighted={tab !== "blocked" && isFollowStateHighlighted(resolveFollowStateOfUser(item))}
            onPressAction={() => changeRelationshipWithUser.mutate(item)}
            onPressUser={() => navigation.push("UserProfile", { userId: item.id })}
            onPressMore={() => undefined}
          />
        )}
        ListEmptyComponent={
          isLoading || error ? null : (
            <Text size={14} lineHeight={16.8} color={colors.textSubtle} align="center" style={styles.empty}>
              Nobody here yet
            </Text>
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { height: 48, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  search: { paddingHorizontal: 16 },
  searchBox: { height: 44, borderRadius: 8 },
  tabsBar: { flexGrow: 0, marginTop: 8 },
  tabs: { paddingLeft: 16, paddingRight: 16, paddingVertical: 12, gap: 8 },
  sort: { marginTop: 24, paddingHorizontal: 16 },
  list: { paddingTop: 74, paddingBottom: 40 },
  separator: { height: 8 },
  empty: { marginTop: 24 },
});
