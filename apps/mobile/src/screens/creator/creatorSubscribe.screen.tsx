import { useMutation, useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";

import { SelectableRow } from "@/components/cart/selectableRow";
import { creatorQueryKeys } from "@/components/creator/creatorQueries.hook";
import { StatusPill } from "@/components/escrow/statusPill";
import { useUserProfileQuery } from "@/components/profile/profileQueries.hook";
import { VerificationBadge } from "@/components/profile/verificationBadge";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/ui/header";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { generateIdempotencyKey } from "@/services/apiClient.service";
import { creatorProgramService } from "@/services/creatorProgram.service";
import { paymentsService } from "@/services/payments.service";
import type { CreatorSubscriptionState } from "@/types/creator.type";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

export function CreatorSubscribeScreen({ navigation, route }: MainScreenProps<"CreatorSubscribe">) {
  const { creatorId } = route.params;
  const creator = useUserProfileQuery(creatorId);
  const plans = useQuery({ queryKey: creatorQueryKeys.plansOfCreator(creatorId), queryFn: () => creatorProgramService.listSubscriptionPlansOfCreator(creatorId) });
  const [chosenPlanId, setChosenPlanId] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<CreatorSubscriptionState | null>(null);
  const idempotencyKeyForCheckout = useRef(generateIdempotencyKey());
  const planId = chosenPlanId ?? plans.data?.[0]?.id ?? null;
  const chosenPlan = plans.data?.find((plan) => plan.id === planId);

  const subscribe = useMutation({
    mutationFn: async () => {
      const checkout = await creatorProgramService.startSubscriptionCheckout(creatorId, planId!, idempotencyKeyForCheckout.current);
      await paymentsService.openHostedCheckoutInAppBrowser(checkout.checkoutUrl);
      return creatorProgramService.fetchSubscriptionState(checkout.subscriptionId);
    },
    onSuccess: setSubscription,
  });

  if (subscription?.status === "active") {
    return (
      <Screen>
        <Header title="Subscribed" />
        <View style={styles.done}>
          <StatusPill label="Active" tone="success" />
          <Text size={21} weight={600} lineHeight={25.2} align="center">You're subscribed to {creator.data?.name}!</Text>
          <Text size={14} lineHeight={19.6} color={colors.textMuted} align="center">Enjoy {chosenPlan?.name}. Manage or cancel anytime in Settings.</Text>
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
                <Text size={16} weight={600} lineHeight={19.2}>{creator.data.name}</Text>
                <VerificationBadge verification={creator.data.verification} legacyVerified={creator.data.verified} />
              </View>
              <Text size={13} lineHeight={16.9} color={colors.textSubtle}>@{creator.data.username}</Text>
            </View>
          </View>
        ) : null}
        {plans.isLoading ? <ActivityIndicator color={colors.primary} /> : null}
        {plans.data?.length === 0 ? <Text color={colors.textSubtle}>This creator doesn't offer subscriptions yet.</Text> : null}
        {(plans.data ?? []).map((plan) => (
          <SelectableRow key={plan.id} selected={plan.id === planId} onPress={() => setChosenPlanId(plan.id)} accessibilityLabel={`${plan.name}, ${formatMoneyForDisplay(plan.price)} per ${plan.interval}`}>
            <Text size={15} weight={600} lineHeight={18}>{plan.name}</Text>
            <Text size={14} weight={500} lineHeight={16.8} color={colors.primary}>{formatMoneyForDisplay(plan.price)} / {plan.interval}</Text>
            {plan.benefits.map((benefit) => (
              <Text key={benefit} size={13} lineHeight={17.5} color={colors.textMuted}>• {benefit}</Text>
            ))}
          </SelectableRow>
        ))}
        <Text size={12} lineHeight={16.8} color={colors.textSubtle}>You'll pay securely on our payment partner's page. Renews automatically until you cancel.</Text>
      </ScrollView>
      <View style={styles.footer}>
        {subscribe.isError ? <Text size={12} color={colors.error} align="center">{subscribe.error.message}</Text> : null}
        {subscription ? <Text size={12} color={colors.caution} align="center">Payment not completed yet. Try again when ready.</Text> : null}
        <Button title={chosenPlan ? `Subscribe for ${formatMoneyForDisplay(chosenPlan.price)}` : "Subscribe"} disabled={!planId} loading={subscribe.isPending} onPress={() => subscribe.mutate()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 12 },
  creator: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  done: { flex: 1, padding: 32, justifyContent: "center", alignItems: "center", gap: 12 },
  footer: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 8 },
});
