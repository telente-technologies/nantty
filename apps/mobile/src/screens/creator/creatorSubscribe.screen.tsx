import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Platform, ScrollView, StyleSheet, View } from "react-native";

import { SelectableRow } from "@/components/cart/selectableRow";
import { creatorQueryKeys } from "@/components/creator/creatorQueries.hook";
import { NEEDS_APP_BUILD_MESSAGE, useCreatorStoreSubscription } from "@/components/creator/creatorStoreSubscription.hook";
import { StatusPill } from "@/components/escrow/statusPill";
import { useUserProfileQuery } from "@/components/profile/profileQueries.hook";
import { VerificationBadge } from "@/components/profile/verificationBadge";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/ui/header";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { generateIdempotencyKey } from "@/services/core/apiClient.service";
import { creatorProgramService } from "@/services/creators/creatorProgram.service";
import { StorePurchaseCancelledError } from "@/services/money/creatorStorePurchase.service";
import { storeBillingChannel } from "@/services/money/nativeStoreBilling.service";
import { paymentsService } from "@/services/commerce/payments.service";
import type { CreatorSubscriptionCheckout, CreatorSubscriptionState } from "@/types/creator.type";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";
import { ErrorState } from "@/components/ui/errorState";
import { ListSkeleton } from "@/components/ui/listSkeleton";
import { BulletLine } from "@/components/ui/bulletLine";
import { spacing } from "@/constants/spacing.constant";
import { typeScale } from "@/constants/typography.constant";

const VERIFY_MAX_ATTEMPTS = 6;
const VERIFY_RETRY_DELAY_MS = 1_500;

const waitForMilliseconds = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function verifySubscriptionCheckoutUntilSettled(checkout: CreatorSubscriptionCheckout): Promise<CreatorSubscriptionState> {
  let latest = checkout.subscription;
  for (let attempt = 0; attempt < VERIFY_MAX_ATTEMPTS; attempt++) {
    try {
      latest = await creatorProgramService.verifySubscriptionCheckout(checkout.reference);
    } catch {
      return latest;
    }
    if (latest.status !== "pending") return latest;
    await waitForMilliseconds(VERIFY_RETRY_DELAY_MS * (attempt + 1));
  }
  return latest;
}

export function CreatorSubscribeScreen({ navigation, route }: MainScreenProps<"CreatorSubscribe">) {
  const { colors } = useTheme();
  const { creatorId } = route.params;
  const queryClient = useQueryClient();
  const creator = useUserProfileQuery(creatorId);
  const channel = storeBillingChannel();
  const plans = useQuery({ queryKey: [...creatorQueryKeys.plansOfCreator(creatorId), channel], queryFn: () => creatorProgramService.listSubscriptionPlansOfCreator(creatorId, channel) });
  const [chosenPlanId, setChosenPlanId] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<CreatorSubscriptionState | null>(null);
  const idempotencyKeyForCheckout = useRef(generateIdempotencyKey());
  const planId = chosenPlanId ?? plans.data?.[0]?.id ?? null;
  const chosenPlan = plans.data?.find((plan) => plan.id === planId);
  const store = useCreatorStoreSubscription(creatorId, chosenPlan?.storeProductId);
  const billedByStore = store.availability !== "web";
  const priceLabelOf = (plan: NonNullable<typeof chosenPlan>) =>
    (plan.id === chosenPlan?.id && store.storeDisplayPrice) || formatMoneyForDisplay(plan.channelPrice ?? plan.price);

  const subscribe = useMutation({
    mutationFn: async () => {
      if (billedByStore) return store.subscribe.mutateAsync(planId!);
      const checkout = await creatorProgramService.startSubscriptionCheckout(creatorId, planId!, idempotencyKeyForCheckout.current);
      idempotencyKeyForCheckout.current = generateIdempotencyKey();
      await paymentsService.openHostedCheckoutInAppBrowser(checkout.checkoutUrl).catch(() => "dismissed");
      return verifySubscriptionCheckoutUntilSettled(checkout);
    },
    onSuccess: (state) => {
      setSubscription(state);
      if (state.status === "active") {
        idempotencyKeyForCheckout.current = generateIdempotencyKey();
        queryClient.invalidateQueries({ queryKey: creatorQueryKeys.plansOfCreator(creatorId) });
        queryClient.invalidateQueries({ queryKey: creatorQueryKeys.mySubscriptions });
      }
    },
  });

  if (subscription?.status === "active") {
    return (
      <Screen>
        <Header title="Subscribed" />
        <View style={styles.done}>
          <StatusPill label="Active" tone="success" />
          <Text size={21} weight={600} lineHeight={25.2} align="center">You're subscribed to {creator.data?.name}!</Text>
          <Text size={typeScale.md} lineHeight={19.6} color={colors.textMuted} align="center">Enjoy {chosenPlan?.name}. Manage or cancel anytime in Settings.</Text>
          <Button title="Back to profile" onPress={() => navigation.goBack()} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title="Subscribe" />
      <ScrollView contentContainerStyle={styles.content}>
        {creator.data ? (
          <View style={styles.creator}>
            <Avatar uri={creator.data.avatarUrl} size={56} />
            <View style={styles.flex}>
              <View style={styles.nameRow}>
                <Text size={typeScale.base} weight={600} lineHeight={19.2}>{creator.data.name}</Text>
                <VerificationBadge verification={creator.data.verification} legacyVerified={creator.data.verified} />
              </View>
              <Text size={typeScale.sm} lineHeight={16.9} color={colors.textSubtle}>@{creator.data.username}</Text>
            </View>
          </View>
        ) : null}
        {plans.isLoading ? <ListSkeleton rows={3} /> : null}
        {plans.isError && !plans.data ? <ErrorState error={plans.error} compact message="Couldn't load subscription plans." onRetry={() => plans.refetch()} retrying={plans.isRefetching} /> : null}
        {plans.data?.length === 0 ? <Text color={colors.textSubtle}>This creator doesn't offer subscriptions yet.</Text> : null}
        {(plans.data ?? []).map((plan) => (
          <SelectableRow key={plan.id} selected={plan.id === planId} onPress={() => setChosenPlanId(plan.id)} accessibilityLabel={`${plan.name}, ${priceLabelOf(plan)} per ${plan.interval}`}>
            <Text size={15} weight={600} lineHeight={18}>{plan.name}</Text>
            <Text size={typeScale.md} weight={500} lineHeight={16.8} color={colors.primary}>{priceLabelOf(plan)} / {plan.interval}</Text>
            {plan.benefits.map((benefit) => (
              <BulletLine key={benefit} size={13} lineHeight={17.5}>{benefit}</BulletLine>
            ))}
          </SelectableRow>
        ))}
        <Text size={typeScale.xs} lineHeight={16.8} color={colors.textSubtle}>
          {billedByStore
            ? `Billed by ${Platform.OS === "ios" ? "the App Store" : "Google Play"}. Renews automatically until you cancel in your store subscription settings.`
            : "You'll pay in a secure payment window. Renews automatically until you cancel."}
        </Text>
        {store.availability === "needsAppBuild" ? <Text size={typeScale.sm} lineHeight={18} color={colors.caution} accessibilityRole="alert">{NEEDS_APP_BUILD_MESSAGE}</Text> : null}
        {store.availability === "ready" && chosenPlan && !chosenPlan.storeProductId ? (
          <Text size={typeScale.xs} lineHeight={16.8} color={colors.caution}>This plan can only be bought on the web.</Text>
        ) : null}
        {store.availability === "ready" ? (
          <Text size={typeScale.sm} weight={500} color={colors.primary} accessibilityRole="button" onPress={() => store.restore.mutate()}>
            {store.restore.isPending ? "Restoring purchases…" : "Restore purchases"}
          </Text>
        ) : null}
        {store.restore.isSuccess ? <Text size={typeScale.xs} color={colors.textMuted}>{store.restore.data.length ? `Restored ${store.restore.data.length} subscription(s).` : "No subscriptions to restore."}</Text> : null}
      </ScrollView>
      <View style={styles.footer}>
        {subscribe.isError && !(subscribe.error instanceof StorePurchaseCancelledError) ? <Text size={typeScale.xs} color={colors.error} align="center">{subscribe.error.message}</Text> : null}
        {subscription ? <Text size={typeScale.xs} color={colors.caution} align="center">Payment not completed yet. Try again when ready.</Text> : null}
        <Button
          title={chosenPlan ? `Subscribe for ${priceLabelOf(chosenPlan)}` : "Subscribe"}
          disabled={!planId || store.availability === "needsAppBuild" || (store.availability === "ready" && !chosenPlan?.storeProductId)}
          loading={subscribe.isPending} onPress={() => subscribe.mutate()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: spacing[4], paddingTop: spacing[2], paddingBottom: spacing[6], gap: spacing[3] },
  creator: { flexDirection: "row", alignItems: "center", gap: spacing[3], marginBottom: spacing[2] },
  nameRow: { flexDirection: "row", alignItems: "center", gap: spacing[1] },
  done: { flex: 1, padding: spacing[7], justifyContent: "center", alignItems: "center", gap: spacing[3] },
  footer: { paddingHorizontal: spacing[4], paddingTop: spacing[2], paddingBottom: spacing[6], gap: spacing[2] },
});
