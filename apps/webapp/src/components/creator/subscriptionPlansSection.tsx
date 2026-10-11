"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import styles from "@/components/escrow/escrow.module.css";
import chipStyles from "@/components/ui/filterChips.module.css";
import { AppIcon } from "@/components/ui/appIcon";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/controls";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/feedback";
import { TextAreaField, TextField } from "@/components/ui/field";
import { Avatar } from "@/components/ui/media";
import { createIdempotencyKey, readErrorMessageForDisplay } from "@/services/clientApi.service";
import { creatorProgramService } from "@/services/creatorProgram.service";
import { useLocaleStore } from "@/store/locale.store";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

const myPlansQueryKey = ["creator-program", "my-plans"] as const;

export function SubscriptionPlansSection() {
  const queryClient = useQueryClient();
  const currency = useLocaleStore((state) => state.currency);
  const plans = useQuery({ queryKey: myPlansQueryKey, queryFn: creatorProgramService.listMySubscriptionPlans, retry: false });
  const subscribers = useQuery({ queryKey: ["creator-program", "subscribers"], queryFn: creatorProgramService.listMySubscribers, retry: false });
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [billingInterval, setBillingInterval] = useState<"month" | "year">("month");
  const [chosenTier, setChosenTier] = useState<string | null>(null);
  const [benefitsText, setBenefitsText] = useState("");
  const createKey = useRef(createIdempotencyKey("creator-plan"));
  const tiers = useQuery({
    queryKey: ["creator-program", "price-tiers", currency, billingInterval],
    queryFn: () => creatorProgramService.listMySubscriptionPriceTiers(currency, billingInterval),
    enabled: formOpen,
    retry: false,
  });
  const tier = tiers.data?.find((candidate) => candidate.tier === chosenTier) ?? tiers.data?.find((candidate) => candidate.default) ?? tiers.data?.[0];
  const refreshPlans = () => queryClient.invalidateQueries({ queryKey: myPlansQueryKey });

  const createPlan = useMutation({
    mutationFn: () => creatorProgramService.createMySubscriptionPlan({
      name: name.trim(),
      price: tier!.prices.web,
      interval: billingInterval,
      benefits: benefitsText.split("\n").map((benefit) => benefit.trim()).filter(Boolean),
    }, createKey.current),
    onSuccess: () => {
      setFormOpen(false);
      setName("");
      setChosenTier(null);
      setBenefitsText("");
      createKey.current = createIdempotencyKey("creator-plan");
      void refreshPlans();
    },
  });
  const togglePlan = useMutation({
    mutationFn: ({ planId, active }: { readonly planId: string; readonly active: boolean }) => creatorProgramService.setMySubscriptionPlanActive(planId, active),
    onSuccess: () => void refreshPlans(),
  });

  return (
    <section className={styles.card} aria-labelledby="subscription-plans-title">
      <h2 id="subscription-plans-title" className={styles.noticeTitle}><AppIcon name="crown24" size={18} /> Subscription plans</h2>
      {plans.isError ? <p className={styles.error} role="alert">{readErrorMessageForDisplay(plans.error)}</p> : null}
      <ul className={styles.list}>
        {(plans.data ?? []).map((plan) => (
          <li key={plan.id} className={styles.listItem}>
            <span className={styles.row}>
              <strong>{plan.name}</strong>
              <Badge tone={plan.active ? "success" : "neutral"}>{plan.active ? "Active" : "Paused"}</Badge>
            </span>
            <span className={styles.muted}>{formatMoneyForDisplay(plan.price)} / {plan.interval} · {plan.subscriberCount.toLocaleString()} subscribers</span>
            <button
              type="button"
              className={styles.textButton}
              disabled={togglePlan.isPending}
              onClick={() => togglePlan.mutate({ planId: plan.id, active: !plan.active })}
            >
              {plan.active ? "Pause new sign-ups" : "Resume plan"}
            </button>
          </li>
        ))}
      </ul>
      {togglePlan.isError ? <p className={styles.error} role="alert">{readErrorMessageForDisplay(togglePlan.error)}</p> : null}
      <Button variant="secondary" onClick={() => setFormOpen(true)}>Create a plan</Button>
      <h3 className={styles.cardTitle}>Recent subscribers</h3>
      <ul className={styles.list}>
        {(subscribers.data ?? []).map((subscriber) => (
          <li key={subscriber.id} className={styles.row}>
            <Avatar name={subscriber.user.name} src={subscriber.user.avatarUrl} size="sm" />
            <span className={styles.grow}>{subscriber.user.name}</span>
            <span className={styles.faint}>{subscriber.planName}</span>
          </li>
        ))}
      </ul>
      <Dialog
        isOpen={formOpen}
        onClose={() => { if (!createPlan.isPending) setFormOpen(false); }}
        title="New subscription plan"
        intent="subscribe"
        actions={[{ label: "Create plan", variant: "primary", busy: createPlan.isPending, disabled: !name.trim() || !tier, onClick: () => { if (!createPlan.isPending) createPlan.mutate(); } }]}
      >
        <div className={styles.actions}>
          <TextField label="Plan name" placeholder="e.g. Kitchen Circle" value={name} maxLength={40} onChange={(event) => setName(event.target.value)} />
          <SegmentedControl label="Billing" value={billingInterval} onChange={(value) => { setBillingInterval(value); setChosenTier(null); }} options={[{ value: "month", label: "Monthly" }, { value: "year", label: "Yearly" }]} />
          <span className={styles.cardTitle}>Price</span>
          <div className={styles.thumbs} role="radiogroup" aria-label="Price">
            {(tiers.data ?? []).map((candidate) => (
              <button
                key={candidate.tier}
                type="button"
                role="radio"
                aria-checked={candidate.tier === tier?.tier}
                className={[chipStyles.chip, candidate.tier === tier?.tier ? chipStyles.chipActive : ""].filter(Boolean).join(" ")}
                onClick={() => setChosenTier(candidate.tier)}
              >
                {formatMoneyForDisplay(candidate.prices.web)}
              </button>
            ))}
          </div>
          {tiers.isError ? <p className={styles.error} role="alert">{readErrorMessageForDisplay(tiers.error)}</p> : null}
          {tier ? (
            <p className={styles.muted}>
              {`Fans pay ${formatMoneyForDisplay(tier.prices.ios)} in the iPhone app and ${formatMoneyForDisplay(tier.prices.android)} on Android, so the app store fee is added to the fan's price, not taken from your earnings.`}
            </p>
          ) : null}
          <TextAreaField label="Benefits (one per line)" placeholder={"Subscriber-only lives\nMonthly discount code"} rows={3} value={benefitsText} onChange={(event) => setBenefitsText(event.target.value)} />
          {createPlan.isError ? <p className={styles.error} role="alert">{readErrorMessageForDisplay(createPlan.error)}</p> : null}
        </div>
      </Dialog>
    </section>
  );
}
