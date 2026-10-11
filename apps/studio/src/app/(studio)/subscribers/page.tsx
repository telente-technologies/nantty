"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { requestConfirmation } from "@zudomart/web-kit";

import { NewPlanForm } from "@/components/subscribers/newPlanForm";
import { Button } from "@/components/ui/button";
import { Badge, EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Card, DataRows, PageHeader, StatGrid, pageStyles } from "@/components/ui/studioPage";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { subscriptionsService } from "@/services/subscriptions.service";
import { walletService } from "@/services/wallet.service";
import type { SubscriptionPlan } from "@/types/audience.type";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default function SubscribersPage() {
  const queryClient = useQueryClient();
  const plans = useQuery({ queryKey: ["subscription-plans"], queryFn: subscriptionsService.listPlans });
  const subscribers = useQuery({ queryKey: ["subscribers"], queryFn: subscriptionsService.listSubscribers });
  const wallet = useQuery({ queryKey: ["wallet", "me"], queryFn: walletService.fetchMine });
  const refreshPlans = () => queryClient.invalidateQueries({ queryKey: ["subscription-plans"] });
  const active = (subscribers.data ?? []).filter((subscriber) => subscriber.status !== "cancelled");
  const ending = (subscribers.data ?? []).filter((subscriber) => subscriber.status === "cancelled");

  async function togglePlan(plan: SubscriptionPlan) {
    await requestConfirmation({
      title: plan.active ? `Stop selling ${plan.name}?` : `Start selling ${plan.name} again?`,
      description: plan.active ? `New fans can't join. Your ${plan.subscriberCount} current subscribers keep their perks until they cancel.` : "Fans can subscribe to this tier again.",
      confirmLabel: plan.active ? "Stop selling" : "Start selling",
      intent: plan.active ? "archive" : "restore",
      onConfirm: async () => {
        await subscriptionsService.setPlanActive(plan.id, !plan.active);
        await refreshPlans();
      },
      describeError: readErrorMessageForDisplay,
    });
  }

  return (
    <div className={pageStyles.page}>
      <PageHeader title="Subscribers" subtitle="Monthly or yearly tiers fans pay for. Set prices here; app-store fees are shown before you publish." />
      <StatGrid
        label="Subscriber totals"
        stats={[
          { label: "Active subscribers", value: subscribers.data ? String(active.length) : "…" },
          { label: "Cancelled, perks until period end", value: subscribers.data ? String(ending.length) : "…" },
          { label: "Tiers on sale", value: plans.data ? String(plans.data.filter((plan) => plan.active).length) : "…" },
        ]}
      />
      <Card title="Your tiers">
        {plans.isError ? <ErrorState title="Tiers didn't load" error={plans.error} onRetry={() => void plans.refetch()} /> : null}
        {plans.isLoading ? <Skeleton height={60} /> : null}
        {plans.data?.length === 0 ? <EmptyState title="No tiers yet" description="Create your first tier below. Most creators start with one monthly tier and two or three perks." /> : null}
        <DataRows
          rows={(plans.data ?? []).map((plan) => ({
            key: plan.id,
            label: <span>{plan.name} {plan.active ? <Badge tone="success">On sale</Badge> : <Badge>Not on sale</Badge>}</span>,
            detail: `${plan.subscriberCount} subscribers${plan.benefits.length ? ` · ${plan.benefits.join(", ")}` : ""}`,
            value: (
              <span className={pageStyles.inlineActions}>
                {formatMoneyForDisplay(plan.price)}/{plan.interval === "year" ? "yr" : "mo"}
                <Button size="sm" variant="ghost" onClick={() => void togglePlan(plan)}>{plan.active ? "Stop selling" : "Sell again"}</Button>
              </span>
            ),
          }))}
        />
      </Card>
      <Card title="Create a tier">
        <NewPlanForm currency={wallet.data?.available.currency ?? "NGN"} onCreated={() => void refreshPlans()} />
      </Card>
      <Card title="People subscribed to you">
        {subscribers.isError ? <ErrorState title="Subscribers didn't load" error={subscribers.error} onRetry={() => void subscribers.refetch()} /> : null}
        {subscribers.isLoading ? <Skeleton height={60} /> : null}
        {subscribers.data?.length === 0 ? <EmptyState title="No subscribers yet" description="Mention your tier in your next live and pin a subscriber-only clip so fans see what they get." /> : null}
        <DataRows
          rows={(subscribers.data ?? []).map((subscriber) => ({
            key: subscriber.id,
            label: subscriber.user ? `${subscriber.user.name} @${subscriber.user.username}` : "Deleted account",
            detail: `${subscriber.planName} · since ${shortDate(subscriber.since)}`,
            value: subscriber.status === "past_due" ? "Payment failed, retrying" : subscriber.status === "cancelled" ? "Cancelled" : subscriber.renewsAt ? `Renews ${shortDate(subscriber.renewsAt)}` : "Active",
          }))}
        />
      </Card>
    </div>
  );
}
