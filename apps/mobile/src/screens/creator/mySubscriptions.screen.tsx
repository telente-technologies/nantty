import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Linking, Platform, ScrollView, StyleSheet, View } from "react-native";

import { creatorQueryKeys, useMySubscriptionsQuery } from "@/components/creator/creatorQueries.hook";
import { StatusPill, type StatusTone } from "@/components/escrow/statusPill";
import { useUserProfileQuery } from "@/components/profile/profileQueries.hook";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Crown24Icon } from "@/components/icons";
import { EmptyState } from "@/components/ui/emptyState";
import { ErrorState } from "@/components/ui/errorState";
import { Header } from "@/components/ui/header";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { usePullToRefresh } from "@/components/ui/pullToRefresh.hook";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { creatorProgramService } from "@/services/creators/creatorProgram.service";
import type { CreatorSubscriptionState } from "@/types/creator.type";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";
import { showAlertWithButtons } from "@/utils/crossPlatformAlert.util";
import { spacing } from "@/constants/spacing.constant";
import { typeScale } from "@/constants/typography.constant";
import { describeActionFailure } from "@/errors/errorExperience/describeError";

const STATUS_PRESENTATION: Record<CreatorSubscriptionState["status"], { label: string; tone: StatusTone }> = {
  pending: { label: "Pending", tone: "caution" },
  active: { label: "Active", tone: "success" },
  past_due: { label: "Past due", tone: "caution" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  expired: { label: "Expired", tone: "neutral" },
  failed: { label: "Failed", tone: "error" },
};

const canCancel = (status: CreatorSubscriptionState["status"]) => status === "active" || status === "past_due";
const canResume = (status: CreatorSubscriptionState["status"]) => status === "cancelled";
const STORE_SUBSCRIPTION_SETTINGS = { apple_iap: "https://apps.apple.com/account/subscriptions", google_play: "https://play.google.com/store/account/subscriptions" } as const;

function formatDay(isoDate: string | null): string | null {
  if (!isoDate) return null;
  return new Date(isoDate).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

export function MySubscriptionsScreen({ navigation }: MainScreenProps<"MySubscriptions">) {
  const { colors } = useTheme();
  const styles = useStyles();
  const queryClient = useQueryClient();
  const { data: subscriptions = [], isLoading, isError, error, refetch, isRefetching } = useMySubscriptionsQuery();
  const refreshControl = usePullToRefresh(refetch);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: creatorQueryKeys.mySubscriptions });

  const cancel = useMutation({ mutationFn: creatorProgramService.cancelSubscription, onSuccess: invalidate });
  const resume = useMutation({ mutationFn: creatorProgramService.resumeSubscription, onSuccess: invalidate });
  const busyId = cancel.isPending ? cancel.variables : resume.isPending ? resume.variables : null;

  const confirmCancel = (subscription: CreatorSubscriptionState) => {
    const accessUntil = formatDay(subscription.currentPeriodEnd);
    showAlertWithButtons(
      "Stop renewing this subscription?",
      accessUntil ? `Your access continues until ${accessUntil}.` : "Your access continues until the end of the paid period.",
      [
        { text: "Not now", style: "cancel" },
        { text: "Cancel subscription", style: "destructive", onPress: () => cancel.mutate(subscription.subscriptionId) },
      ],
      { intent: "subscribe" },
    );
  };

  return (
    <Screen background={colors.surface}>
      <Header title="Subscriptions" />
      <ScrollView contentContainerStyle={styles.content} refreshControl={refreshControl}>
        {isLoading ? <ListSkeleton rows={3} padding={0} /> : null}
        {isError && subscriptions.length === 0 ? (
          <ErrorState error={error} compact message="Couldn't load your subscriptions." onRetry={() => refetch()} retrying={isRefetching} />
        ) : null}
        {subscriptions.length === 0 && !isLoading && !isError ? (
          <EmptyState compact icon={<Crown24Icon color={colors.textMuted} />} title="No subscriptions yet" body="Subscribe to a creator from their profile to unlock members-only posts." />
        ) : null}
        {subscriptions.map((subscription) => (
          <SubscriptionCard
            key={subscription.subscriptionId}
            subscription={subscription}
            busy={busyId === subscription.subscriptionId}
            onPressCreator={() => navigation.navigate("UserProfile", { userId: subscription.creatorId })}
            onCancel={() => confirmCancel(subscription)}
            onResume={() => resume.mutate(subscription.subscriptionId)}
          />
        ))}
        {cancel.isError ? <Text size={typeScale.xs} color={colors.error}>{describeActionFailure(cancel.error)}</Text> : null}
        {resume.isError ? <Text size={typeScale.xs} color={colors.error}>{describeActionFailure(resume.error)}</Text> : null}
      </ScrollView>
    </Screen>
  );
}

function SubscriptionCard({
  subscription,
  busy,
  onPressCreator,
  onCancel,
  onResume,
}: {
  readonly subscription: CreatorSubscriptionState;
  readonly busy: boolean;
  readonly onPressCreator: () => void;
  readonly onCancel: () => void;
  readonly onResume: () => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const creator = useUserProfileQuery(subscription.creatorId);
  const presentation = STATUS_PRESENTATION[subscription.status];
  const renewsOn = formatDay(subscription.renewsAt ?? subscription.currentPeriodEnd);

  return (
    <View style={styles.card}>
      <View style={styles.identity}>
        <Avatar uri={creator.data?.avatarUrl} size={44} />
        <View style={styles.names}>
          <Text size={15} weight={600} lineHeight={18} numberOfLines={1} onPress={onPressCreator} accessibilityRole="link">
            {creator.data?.name ?? "Creator"}
          </Text>
          <Text size={typeScale.sm} lineHeight={16.9} color={colors.textSubtle} numberOfLines={1}>
            {creator.data?.username ? `@${creator.data.username}` : "@"}
          </Text>
        </View>
        <StatusPill label={presentation.label} tone={presentation.tone} />
      </View>

      <View style={styles.detailRows}>
        <Text size={typeScale.md} lineHeight={19.6} color={colors.text}>
          {formatMoneyForDisplay(subscription.price)} / {subscription.interval}
        </Text>
        {renewsOn ? (
          <Text size={typeScale.sm} lineHeight={16.9} color={colors.textMuted}>
            {canCancel(subscription.status) ? `Renews ${renewsOn}` : `Ended ${renewsOn}`}
          </Text>
        ) : null}
      </View>

      {subscription.billingChannel && subscription.billingChannel !== "web" ? (
        <Button
          title={subscription.billingChannel === "apple_iap" ? "Manage in the App Store" : "Manage in Google Play"}
          variant="outline"
          height={40}
          onPress={() => {
            const settingsUrl = STORE_SUBSCRIPTION_SETTINGS[subscription.billingChannel as keyof typeof STORE_SUBSCRIPTION_SETTINGS];
            const packageQuery = Platform.OS === "android" && subscription.storeProductId ? `?sku=${encodeURIComponent(subscription.storeProductId)}&package=com.zudomart.app` : "";
            void Linking.openURL(settingsUrl + packageQuery);
          }}
        />
      ) : null}
      {canCancel(subscription.status) && (subscription.billingChannel ?? "web") === "web" ? (
        <Button title="Cancel subscription" variant="outline" height={40} disabled={busy} loading={busy} onPress={onCancel} />
      ) : null}
      {canResume(subscription.status) && (subscription.billingChannel ?? "web") === "web" ? (
        <Button title="Resume subscription" height={40} disabled={busy} loading={busy} onPress={onResume} />
      ) : null}
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  content: { paddingHorizontal: spacing[4], paddingTop: spacing[2], paddingBottom: spacing[8], gap: spacing[3] },
  card: { borderWidth: 1, borderColor: colors.divider, borderRadius: 12, padding: 14, gap: spacing[3] },
  identity: { flexDirection: "row", alignItems: "center", gap: 10 },
  names: { flex: 1, gap: 2 },
  detailRows: { gap: 2 },
}));
