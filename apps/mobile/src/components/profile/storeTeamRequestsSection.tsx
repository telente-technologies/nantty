import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { linkedProfilesQueryKey } from "@/hooks/useLinkedProfiles.hook";
import { brandsService } from "@/services/sellers/brands.service";
import { makeThemedStyles, useTheme } from "@/theme";
import type { StoreTeamRequest } from "@/types/brand.type";

const teamRequestsQueryKey = ["stores", "team-requests"] as const;

export function StoreTeamRequestsSection() {
  const { colors } = useTheme();
  const styles = useStyles();
  const queryClient = useQueryClient();
  const requests = useQuery({
    queryKey: teamRequestsQueryKey,
    queryFn: brandsService.fetchStoreTeamRequests,
    retry: false,
  });
  const respond = useMutation({
    mutationFn: ({ requestId, decision }: { readonly requestId: string; readonly decision: "accept" | "decline" }) =>
      decision === "accept"
        ? brandsService.acceptStoreTeamRequest(requestId)
        : brandsService.declineStoreTeamRequest(requestId),
    onSuccess: (_result, { requestId }) => {
      queryClient.setQueryData<readonly StoreTeamRequest[]>(teamRequestsQueryKey, (current = []) =>
        current.filter((item) => item.id !== requestId),
      );
      void queryClient.invalidateQueries({ queryKey: linkedProfilesQueryKey });
    },
  });

  const items = requests.data ?? [];
  if (requests.isPending || requests.isError || items.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text size={14} weight={600}>Store team invitations</Text>
      {items.map((invite) => (
        <View key={invite.id} style={styles.card}>
          <Text size={14} weight={600}>{invite.storeName}</Text>
          <Text size={12} color={colors.textMuted}>Role: {invite.role}</Text>
          <View style={styles.actions}>
            <Button title="Accept" variant="primary" disabled={respond.isPending} onPress={() => respond.mutate({ requestId: invite.id, decision: "accept" })} style={styles.action} />
            <Button title="Decline" variant="subtle" disabled={respond.isPending} onPress={() => respond.mutate({ requestId: invite.id, decision: "decline" })} style={styles.action} />
          </View>
        </View>
      ))}
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  section: { gap: 10 },
  card: { padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.divider, gap: 8 },
  actions: { flexDirection: "row", gap: 8 },
  action: { flex: 1 },
}));
