import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDeferredValue, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { ArrowLeft24Icon, MagnifyingGlass20Icon, SlidersHorizontal24Icon, Users24Icon } from "@/components/icons";
import { connectionSortLabel, sortAndFilterConnections } from "@/components/profile/connectionSort.util";
import { ConnectionSortSheet } from "@/components/profile/connectionSortSheet";
import { ConnectionOptionsSheet } from "@/components/profile/connectionOptionsSheet";
import { ConnectionRow } from "@/components/profile/connectionRow";
import { followButtonLabelForState, isFollowStateHighlighted, resolveFollowStateOfUser } from "@/components/profile/followState.util";
import { profileQueryKeys } from "@/components/profile/profileQueries.hook";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/emptyState";
import { usePullToRefresh } from "@/components/ui/pullToRefresh.hook";
import { ErrorState } from "@/components/ui/errorState";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { TextField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { radius, spacing } from "@/constants/spacing.constant";
import { typeScale } from "@/constants/typography.constant";
import { Screen } from "@/components/ui/screen";
import { useTheme } from "@/theme";
import { ApiError } from "@/errors/api.error";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { followsService } from "@/services/follows.service";
import { useAuthStore } from "@/store/auth.store";
import { DEFAULT_CONNECTION_PREFERENCE, useListViewPreferencesStore } from "@/store/listViewPreferences.store";
import type { ConnectionEntry, ConnectionTab } from "@/types/account.type";
import { requireAuthThen } from "@/utils/requireAuth.util";

const TABS: { key: ConnectionTab; label: string }[] = [
  { key: "followers", label: "Followers" },
  { key: "following", label: "Following" },
  { key: "shopped", label: "Shopped" },
  { key: "suggested", label: "Suggested" },
  { key: "blocked", label: "Blocked" },
];

export function ConnectionsScreen({ navigation, route }: MainScreenProps<"Connections">) {
  const { colors } = useTheme();
  const { userId } = route.params;
  const [tab, setTab] = useState<ConnectionTab>(route.params.tab ?? "followers");
  const [search, setSearch] = useState("");
  const [entryWithOpenMenu, setEntryWithOpenMenu] = useState<ConnectionEntry | null>(null);
  const [isSortSheetOpen, setIsSortSheetOpen] = useState(false);
  const isMyConnections = useAuthStore((s) => s.user?.id) === userId;
  const visibleTabs = isMyConnections ? TABS : TABS.filter((t) => t.key !== "blocked" && t.key !== "shopped");
  const queryClient = useQueryClient();
  const deferredSearch = useDeferredValue(search.trim());
  const isSearchableListTab = tab === "followers" || tab === "following";
  const { data: entries = [], isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: [...profileQueryKeys.connections(userId, tab), isSearchableListTab ? deferredSearch : ""],
    queryFn: async () => {
      if (tab === "followers") return (await followsService.listFollowersOfUser(userId, deferredSearch)).data;
      if (tab === "following") return (await followsService.listFollowingOfUser(userId, deferredSearch)).data;
      return followsService.listConnectionsOfUser(userId, tab);
    },
    retry: (failureCount, failure) => !(failure instanceof ApiError && failure.status === 403) && failureCount < 2,
  });
  const refreshControl = usePullToRefresh(refetch);
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

  const preferenceKey = `connections:${tab}`;
  const preference = useListViewPreferencesStore((state) => state.connectionsByScreen[preferenceKey]) ?? DEFAULT_CONNECTION_PREFERENCE;
  const setConnectionPreference = useListViewPreferencesStore((state) => state.setConnectionPreference);
  const showRelationshipFilter = tab !== "blocked";
  const activeFilter = showRelationshipFilter ? preference.filter : "all";
  const searchedEntries = isSearchableListTab
    ? entries
    : entries.filter((e) => !search.trim() || `${e.name} ${e.username}`.toLowerCase().includes(search.trim().toLowerCase()));
  const filteredEntries = sortAndFilterConnections(searchedEntries, preference.sort, activeFilter);
  const isCustomised = preference.sort !== "recent" || activeFilter !== "all";

  const actionLabelFor = (entry: ConnectionEntry) => (tab === "blocked" ? "Unblock" : followButtonLabelForState(resolveFollowStateOfUser(entry)));

  return (
    <Screen background={colors.surface}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" hitSlop={10} onPress={() => navigation.goBack()}>
          <ArrowLeft24Icon />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Sort and filter. ${connectionSortLabel(preference.sort)}${isCustomised ? ", filters on" : ""}`}
          hitSlop={10}
          onPress={() => setIsSortSheetOpen(true)}
        >
          <SlidersHorizontal24Icon color={isCustomised ? colors.primary : undefined} />
        </Pressable>
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
      <Pressable accessibilityRole="button" accessibilityLabel={`Sort by ${connectionSortLabel(preference.sort)}. Change`} onPress={() => setIsSortSheetOpen(true)} style={styles.sort}>
        <Text size={typeScale.md} weight={500} lineHeight={20}>Sort by {connectionSortLabel(preference.sort)}</Text>
      </Pressable>
      {isListHiddenBecausePrivate ? (
        <ErrorState message="This account is private. Follow them to see their followers and following." />
      ) : error ? (
        <ErrorState message="Couldn't load this list." onRetry={() => refetch()} retrying={isRefetching} />
      ) : isLoading ? (
        <ListSkeleton />
      ) : null}
      <FlatList
        data={error || isLoading ? [] : filteredEntries}
        keyExtractor={(entry) => entry.id}
        contentContainerStyle={styles.list}
        refreshControl={refreshControl}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => (
          <ConnectionRow
            user={item}
            actionLabel={item.id === useAuthStore.getState().user?.id ? undefined : actionLabelFor(item)}
            actionHighlighted={tab !== "blocked" && isFollowStateHighlighted(resolveFollowStateOfUser(item))}
            onPressAction={() => requireAuthThen(() => changeRelationshipWithUser.mutate(item), undefined, "follow people")}
            onPressUser={() => navigation.push("UserProfile", { userId: item.id })}
            onPressMore={item.id === useAuthStore.getState().user?.id ? undefined : () => setEntryWithOpenMenu(item)}
          />
        )}
        ListEmptyComponent={
          isLoading || error ? null : (
            <EmptyState
              compact
              icon={<Users24Icon color={colors.textMuted} />}
              title={search.trim() ? `No one matches “${search.trim()}”` : "Nobody here yet"}
              body={search.trim() ? "Try a different name or username." : undefined}
            />
          )
        }
      />
      <ConnectionSortSheet
        visible={isSortSheetOpen}
        value={{ sort: preference.sort, filter: activeFilter }}
        showRelationshipFilter={showRelationshipFilter}
        onChange={(next) => setConnectionPreference(preferenceKey, next)}
        onClose={() => setIsSortSheetOpen(false)}
      />
      <ConnectionOptionsSheet
        entry={entryWithOpenMenu}
        isBlockedTab={tab === "blocked"}
        onClose={() => setEntryWithOpenMenu(null)}
        onOpenProfile={(id) => navigation.push("UserProfile", { userId: id })}
        onMessage={(entry) => navigation.navigate("Chat", { userId: entry.id, name: entry.name })}
        onRelationshipChanged={() => queryClient.invalidateQueries({ queryKey: ["users", userId, "connections"] })}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { height: 48, paddingHorizontal: spacing[4], flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  search: { paddingHorizontal: spacing[4] },
  searchBox: { height: 44, borderRadius: radius.sm },
  tabsBar: { flexGrow: 0, marginTop: spacing[2] },
  tabs: { paddingHorizontal: spacing[4], paddingVertical: spacing[3], gap: spacing[2] },
  sort: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center", paddingHorizontal: spacing[4] },
  list: { paddingTop: spacing[2], paddingBottom: spacing[8] },
  separator: { height: spacing[2] },
});
