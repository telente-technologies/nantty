import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { Crown24Icon, Ticket24Icon } from "@/components/icons";
import { StatusPill } from "@/components/escrow/statusPill";
import { Avatar } from "@/components/ui/avatar";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { TextField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import { creatorProgramService } from "@/services/creators/creatorProgram.service";
import { useLocaleStore } from "@/store/locale.store";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

import { creatorQueryKeys } from "./creatorQueries.hook";

export function SubscriptionPlansSection() {
  const { colors } = useTheme();
  const styles = useStyles();
  const queryClient = useQueryClient();
  const currency = useLocaleStore((state) => state.currency);
  const plans = useQuery({ queryKey: creatorQueryKeys.myPlans, queryFn: creatorProgramService.listMySubscriptionPlans });
  const subscribers = useQuery({ queryKey: creatorQueryKeys.subscribers, queryFn: creatorProgramService.listMySubscribers });
  const [formVisible, setFormVisible] = useState(false);
  const [name, setName] = useState("");
  const [chosenTier, setChosenTier] = useState<string | null>(null);
  const [billingInterval, setBillingInterval] = useState<"month" | "year">("month");
  const tiers = useQuery({
    queryKey: ["creator-program", "price-tiers", currency, billingInterval],
    queryFn: () => creatorProgramService.listMySubscriptionPriceTiers(currency, billingInterval),
    enabled: formVisible,
  });
  const tier = tiers.data?.find((candidate) => candidate.tier === chosenTier) ?? tiers.data?.find((candidate) => candidate.default) ?? tiers.data?.[0];
  const [benefitsText, setBenefitsText] = useState("");
  const refreshPlans = () => queryClient.invalidateQueries({ queryKey: creatorQueryKeys.myPlans });

  const createPlan = useMutation({
    mutationFn: () =>
      creatorProgramService.createMySubscriptionPlan({
        name: name.trim(),
        price: tier!.prices.web,
        interval: billingInterval,
        benefits: benefitsText.split("\n").map((benefit) => benefit.trim()).filter(Boolean),
      }),
    onSuccess: () => {
      setFormVisible(false);
      setName("");
      setChosenTier(null);
      setBenefitsText("");
      refreshPlans();
    },
  });
  const togglePlan = useMutation({ mutationFn: ({ planId, active }: { planId: string; active: boolean }) => creatorProgramService.setMySubscriptionPlanActive(planId, active), onSuccess: refreshPlans });

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Crown24Icon size={20} color={colors.textMuted} />
        <Text size={16} weight={600} lineHeight={19.2}>Subscription plans</Text>
      </View>
      {(plans.data ?? []).map((plan) => (
        <View key={plan.id} style={styles.plan}>
          <View style={styles.row}>
            <Text size={14} weight={500} lineHeight={16.8} style={styles.flex}>{plan.name}</Text>
            <StatusPill label={plan.active ? "Active" : "Paused"} tone={plan.active ? "success" : "neutral"} />
          </View>
          <Text size={13} lineHeight={16.9} color={colors.textMuted}>
            {formatMoneyForDisplay(plan.price)} / {plan.interval} · {plan.subscriberCount.toLocaleString()} subscribers
          </Text>
          <Text size={13} weight={500} lineHeight={16.9} color={colors.primary} accessibilityRole="button" onPress={() => togglePlan.mutate({ planId: plan.id, active: !plan.active })}>
            {plan.active ? "Pause new sign-ups" : "Resume plan"}
          </Text>
        </View>
      ))}
      <Button variant="subtle" title="Create a plan" onPress={() => setFormVisible(true)} />
      <Text size={14} weight={500} lineHeight={16.8}>Recent subscribers</Text>
      {(subscribers.data ?? []).map((subscriber) => (
        <View key={subscriber.id} style={styles.row}>
          <Avatar uri={subscriber.user.avatarUrl} size={32} />
          <Text size={14} lineHeight={16.8} style={styles.flex}>{subscriber.user.name}</Text>
          <Text size={12} lineHeight={16.8} color={colors.textSubtle}>{subscriber.planName}</Text>
        </View>
      ))}
      <BottomSheet visible={formVisible} onClose={() => setFormVisible(false)} title="New subscription plan" scrollable>
        <View style={styles.form}>
          <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.chip }}>
            <Ticket24Icon size={22} color={colors.textMuted} />
          </View>
          <TextField label="Plan name" placeholder="e.g. Kitchen Circle" value={name} onChangeText={setName} maxLength={40} />
          <View style={styles.row}>
            <Chip kind="topic" label="Monthly" selected={billingInterval === "month"} onPress={() => setBillingInterval("month")} />
            <Chip kind="topic" label="Yearly" selected={billingInterval === "year"} onPress={() => setBillingInterval("year")} />
          </View>
          <Text size={13} weight={500} lineHeight={16.9}>Price</Text>
          <View style={styles.tiers}>
            {(tiers.data ?? []).map((candidate) => (
              <Chip key={candidate.tier} kind="topic" label={formatMoneyForDisplay(candidate.prices.web)} selected={candidate.tier === tier?.tier} onPress={() => setChosenTier(candidate.tier)} />
            ))}
          </View>
          {tier ? (
            <Text size={12} lineHeight={16.8} color={colors.textMuted}>
              {`Fans pay ${formatMoneyForDisplay(tier.prices.ios)} in the iPhone app and ${formatMoneyForDisplay(tier.prices.android)} on Android, so the app store fee is added to the fan's price, not taken from your earnings.`}
            </Text>
          ) : null}
          <TextField label="Benefits (one per line)" placeholder={"Subscriber-only lives\nMonthly discount code"} multiline value={benefitsText} onChangeText={setBenefitsText} boxStyle={styles.multiline} />
          {createPlan.isError ? <Text size={12} color={colors.error}>{createPlan.error.message}</Text> : null}
          <Button title="Create plan" disabled={!name.trim() || !tier} loading={createPlan.isPending} onPress={() => createPlan.mutate()} />
        </View>
      </BottomSheet>
    </View>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  flex: { flex: 1 },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 16, gap: 12 },
  plan: { gap: 4, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.background },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  tiers: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  form: { paddingBottom: 4, gap: 12 },
  multiline: { height: 90, alignItems: "flex-start", paddingVertical: 10 },
}));
