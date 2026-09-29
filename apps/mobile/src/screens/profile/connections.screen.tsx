import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { ArrowLeft24Icon, DotsThreeVertical24Icon, MagnifyingGlass20Icon } from "@/components/icons";
import { ConnectionRow } from "@/components/profile/connectionRow";
import { profileQueryKeys } from "@/components/profile/profileQueries.hook";
import { Chip } from "@/components/ui/chip";
import { TextField } from "@/components/ui/input";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
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
  const { data: entries = [], isLoading } = useQuery({
    queryKey: profileQueryKeys.connections(userId, tab),
    queryFn: () => followsService.listConnectionsOfUser(userId, tab),
  });

  const changeRelationshipWithUser = useMutation({
    mutationFn: (entry: ConnectionEntry) =>
      tab === "blocked"
        ? followsService.unblockUser(entry.id)
        : entry.isFollowing
          ? followsService.unfollowUser(entry.id)
          : followsService.followUser(entry.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users", userId, "connections"] }),
  });

  const filteredEntries = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return entries;
    return entries.filter((e) => e.name.toLowerCase().includes(term) || e.username.toLowerCase().includes(term));
  }, [entries, search]);

  const actionLabelFor = (entry: ConnectionEntry) => (tab === "blocked" ? "Unblock" : entry.isFollowing ? "Unfollow" : "Follow");

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
      <FlatList
        data={filteredEntries}
        keyExtractor={(entry) => entry.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => (
          <ConnectionRow
            user={item}
            actionLabel={item.id === useAuthStore.getState().user?.id ? undefined : actionLabelFor(item)}
            actionHighlighted={tab !== "blocked" && !item.isFollowing}
            onPressAction={() => changeRelationshipWithUser.mutate(item)}
            onPressUser={() => navigation.push("UserProfile", { userId: item.id })}
            onPressMore={() => undefined}
          />
        )}
        ListEmptyComponent={
          isLoading ? null : (
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
