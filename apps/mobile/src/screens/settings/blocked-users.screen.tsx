import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FlatList, StyleSheet, View } from "react-native";

import { ConnectionRow } from "@/components/profile/connectionRow";
import { Header } from "@/components/ui/header";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import { followsService } from "@/services/follows.service";

const BLOCKED_USERS_QUERY_KEY = ["users", "me", "blocked"] as const;

export function BlockedUsersScreen() {
  const queryClient = useQueryClient();
  const { data: blockedUsers = [], isLoading } = useQuery({ queryKey: BLOCKED_USERS_QUERY_KEY, queryFn: followsService.listMyBlockedUsers });
  const unblockUser = useMutation({
    mutationFn: followsService.unblockUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: BLOCKED_USERS_QUERY_KEY }),
  });

  return (
    <Screen background={colors.white}>
      <Header title="Blocked users" />
      <FlatList
        data={blockedUsers}
        keyExtractor={(user) => user.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => (
          <ConnectionRow user={item} actionLabel="Unblock" onPressAction={() => unblockUser.mutate(item.id)} />
        )}
        ListEmptyComponent={
          isLoading ? null : (
            <Text size={14} lineHeight={16.8} color={colors.textSubtle} align="center" style={styles.empty}>
              You haven't blocked anyone.
            </Text>
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingTop: 24, paddingBottom: 40 },
  separator: { height: 8 },
  empty: { marginTop: 80 },
});
