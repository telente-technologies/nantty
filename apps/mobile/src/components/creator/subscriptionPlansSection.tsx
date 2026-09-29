import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { StatusPill } from "@/components/escrow/statusPill";
import { Avatar } from "@/components/ui/avatar";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { TextField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import { creatorProgramService } from "@/services/creatorProgram.service";
import { useLocaleStore } from "@/store/locale.store";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

import { creatorQueryKeys } from "./creatorQueries.hook";

const convertMajorUnitTextToMinorUnits = (value: string) => Math.round(Number.parseFloat(value || "0") * 100);

export function SubscriptionPlansSection() {
  const queryClient = useQueryClient();
  const currency = useLocaleStore((state) => state.currency);
  const plans = useQuery({ queryKey: creatorQueryKeys.myPlans, queryFn: creatorProgramService.listMySubscriptionPlans });
  const subscribers = useQuery({ queryKey: creatorQueryKeys.subscribers, queryFn: creatorProgramService.listMySubscribers });
  const [formVisible, setFormVisible] = useState(false);
  const [name, setName] = useState("");
  const [priceText, setPriceText] = useState("");
  const [billingInterval, setBillingInterval] = useState<"month" | "year">("month");
  const [benefitsText, setBenefitsText] = useState("");
  const refreshPlans = () => queryClient.invalidateQueries({ queryKey: creatorQueryKeys.myPlans });

  const createPlan = useMutation({
    mutationFn: () =>
      creatorProgramService.createMySubscriptionPlan({
        name: name.trim(),
        price: { amountMinor: convertMajorUnitTextToMinorUnits(priceText), currency },
        interval: billingInterval,
        benefits: benefitsText.split("\n").map((benefit) => benefit.trim()).filter(Boolean),
      }),
    onSuccess: () => {
      setFormVisible(false);
      setName("");
      setPriceText("");
      setBenefitsText("");
      refreshPlans();
    },
  });
  const togglePlan = useMutation({ mutationFn: ({ planId, active }: { planId: string; active: boolean }) => creatorProgramService.setMySubscriptionPlanActive(planId, active), onSuccess: refreshPlans });

  return (
    <View style={styles.card}>
      <Text size={16} weight={600} lineHeight={19.2}>Subscription plans</Text>
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
      <BottomSheet visible={formVisible} onClose={() => setFormVisible(false)} title="New subscription plan">
        <View style={styles.form}>
          <TextField label="Plan name" placeholder="e.g. Kitchen Circle" value={name} onChangeText={setName} maxLength={40} />
          <TextField label={`Price (${currency})`} placeholder="0.00" keyboardType="decimal-pad" value={priceText} onChangeText={(value) => setPriceText(value.replace(/[^\d.]/g, ""))} />
          <View style={styles.row}>
            <Chip kind="topic" label="Monthly" selected={billingInterval === "month"} onPress={() => setBillingInterval("month")} />
            <Chip kind="topic" label="Yearly" selected={billingInterval === "year"} onPress={() => setBillingInterval("year")} />
          </View>
          <TextField label="Benefits (one per line)" placeholder={"Subscriber-only lives\nMonthly discount code"} multiline value={benefitsText} onChangeText={setBenefitsText} boxStyle={styles.multiline} />
          {createPlan.isError ? <Text size={12} color={colors.error}>{createPlan.error.message}</Text> : null}
          <Button title="Create plan" disabled={!name.trim() || convertMajorUnitTextToMinorUnits(priceText) <= 0} loading={createPlan.isPending} onPress={() => createPlan.mutate()} />
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { backgroundColor: colors.white, borderRadius: 12, padding: 16, gap: 12 },
  plan: { gap: 4, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.background },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  form: { paddingHorizontal: 16, paddingBottom: 20, gap: 12 },
  multiline: { height: 90, alignItems: "flex-start", paddingVertical: 10 },
});
