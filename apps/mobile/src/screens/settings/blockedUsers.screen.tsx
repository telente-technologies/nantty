import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FlatList, StyleSheet, View } from "react-native";

import { ConnectionRow } from "@/components/profile/connectionRow";
import { EmptyState } from "@/components/ui/emptyState";
import { ErrorState } from "@/components/ui/errorState";
import { Header } from "@/components/ui/header";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { usePullToRefresh } from "@/components/ui/pullToRefresh.hook";
import { Screen } from "@/components/ui/screen";
import { showToast } from "@/store/toast.store";
import { useTheme } from "@/theme";
import { followsService } from "@/services/social/follows.service";
import { spacing } from "@/constants/spacing.constant";

const BLOCKED_USERS_QUERY_KEY = ["users", "me", "blocked"] as const;

export function BlockedUsersScreen() {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const { data: blockedUsers = [], isLoading, isError, refetch, isRefetching } = useQuery({ queryKey: BLOCKED_USERS_QUERY_KEY, queryFn: followsService.listMyBlockedUsers });
  const refreshControl = usePullToRefresh(refetch);
  const unblockUser = useMutation({
    mutationFn: followsService.unblockUser,
    onSuccess: () => {
      showToast("Unblocked");
      return queryClient.invalidateQueries({ queryKey: BLOCKED_USERS_QUERY_KEY });
    },
    onError: () => showToast("Couldn't unblock. Try again."),
  });

  return (
    <Screen background={colors.surface}>
      <Header title="Blocked users" />
      <FlatList
        data={blockedUsers}
        keyExtractor={(user) => user.id}
        contentContainerStyle={styles.list}
        refreshControl={refreshControl}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => (
          <ConnectionRow user={item} actionLabel="Unblock" onPressAction={() => !unblockUser.isPending && unblockUser.mutate(item.id)} />
        )}
        ListEmptyComponent={
          isLoading ? (
            <ListSkeleton />
          ) : isError ? (
            <ErrorState compact message="Couldn't load blocked accounts." onRetry={() => refetch()} retrying={isRefetching} />
          ) : (
            <EmptyState compact title="You haven't blocked anyone" body="People you block can't find your profile, posts or store, or message you." />
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingTop: spacing[6], paddingBottom: spacing[8] },
  separator: { height: 8 },
});
