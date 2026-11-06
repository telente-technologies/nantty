import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { ErrorState } from "@/components/ui/errorState";
import { Text } from "@/components/ui/text";
import { notificationsService } from "@/services/account/notifications.service";
import { showToast } from "@/store/toast.store";
import { useTheme } from "@/theme";
import type { NotificationPreference } from "@/types/notificationPreference.type";

import { ConsentToggleRow } from "./consentToggleRow";

const queryKey = ["notificationPreferences"] as const;

const categoryTitles: Readonly<Record<string, string>> = {
  auth: "Account security",
  orders: "Orders",
  escrow: "Escrow",
  seller: "Seller activity",
  payments: "Payments",
  creator: "Creator program",
  checkmarks: "Verification",
  social: "Social activity",
  milestones: "Milestones",
  live: "Live",
  trust: "Trust and safety",
  privacy: "Privacy",
  support: "Support",
  marketing: "News and offers",
};

function titleForCategory(category: string) {
  return categoryTitles[category] ?? category.replace(/[-_]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function NotificationPreferenceRows() {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey, queryFn: notificationsService.listPreferences });
  const update = useMutation({
    mutationFn: ({ category, ...change }: { category: string; push?: boolean; email?: boolean }) => notificationsService.updatePreference(category, change),
    onSuccess: (next) =>
      queryClient.setQueryData<NotificationPreference[]>(queryKey, (rows) => (rows ?? []).map((row) => (row.category === next.category ? next : row))),
    onError: () => showToast("Couldn't update this notification preference. Try again.", { tone: "error" }),
  });
  if (query.isLoading) return <ActivityIndicator color={colors.primary} style={styles.loading} />;
  if (query.isError) return <ErrorState error={query.error} compact message="Couldn't load notification categories." onRetry={() => void query.refetch()} retrying={query.isRefetching} />;
  if (!query.data?.length) return null;

  return (
    <View style={styles.container}>
      <Text size={18} weight={600} lineHeight={23}>Notification categories</Text>
      <Text size={13} lineHeight={18} color={colors.textMuted}>
        Choose which categories can reach you by push or email. Security and privacy notices stay on.
      </Text>
      {query.data.map((row) => {
        const title = titleForCategory(row.category);
        const locked = row.locked;
        const pending = update.isPending && update.variables?.category === row.category;
        const push = pending && update.variables?.push !== undefined ? update.variables.push : row.push;
        const email = pending && update.variables?.email !== undefined ? update.variables.email : row.email;
        return (
          <View key={row.category} style={[styles.category, { borderTopColor: colors.divider }]}>
            <Text size={15} weight={600} lineHeight={20}>{title}</Text>
            <ConsentToggleRow
              label={`${title}: push`}
              description={`Push notifications about ${title.toLowerCase()}.`}
              enabled={push}
              disabled={update.isPending || locked}
              onChange={(enabled) => update.mutate({ category: row.category, push: enabled })}
            />
            <ConsentToggleRow
              label={`${title}: email`}
              description={`Email notifications about ${title.toLowerCase()}.`}
              enabled={email}
              disabled={update.isPending || locked}
              onChange={(enabled) => update.mutate({ category: row.category, email: enabled })}
            />
            {locked ? <Text size={12} lineHeight={16} color={colors.textMuted}>Required account notices cannot be turned off.</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10, paddingHorizontal: 20, paddingVertical: 16 },
  category: { gap: 2, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  loading: { padding: 24 },
});
