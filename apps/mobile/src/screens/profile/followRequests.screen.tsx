import { FlatList, StyleSheet } from "react-native";

import { FollowRequestRow } from "@/components/profile/followRequestRow";
import { useFollowRequestsQuery, useSettleFollowRequestMutation } from "@/components/profile/followRequests.hook";
import { ErrorState } from "@/components/ui/errorState";
import { Header } from "@/components/ui/header";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import type { MainScreenProps } from "@/navigation/navigation.types";

export function FollowRequestsScreen({ navigation }: MainScreenProps<"FollowRequests">) {
  const { colors } = useTheme();
  const requests = useFollowRequestsQuery();
  const settleRequest = useSettleFollowRequestMutation();

  return (
    <Screen>
      <Header title="Follow requests" />
      {requests.isPending ? (
        <ListSkeleton />
      ) : requests.isError ? (
        <ErrorState error={requests.error} message="Couldn't load follow requests." onRetry={() => requests.refetch()} />
      ) : (
        <FlatList
          data={requests.data.data}
          keyExtractor={(request) => request.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <FollowRequestRow
              request={item}
              disabled={settleRequest.isPending}
              onApprove={() => settleRequest.mutate({ requestId: item.id, approve: true })}
              onDecline={() => settleRequest.mutate({ requestId: item.id, approve: false })}
              onPressUser={() => navigation.push("UserProfile", { userId: item.requester.id })}
            />
          )}
          ListEmptyComponent={
            <Text size={14} lineHeight={16.8} color={colors.textSubtle} align="center" style={styles.empty}>
              No pending requests
            </Text>
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({ list: { paddingTop: 12, paddingBottom: 40, gap: 4 }, empty: { marginTop: 48 } });
