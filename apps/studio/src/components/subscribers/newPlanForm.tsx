"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/controls";
import { TextAreaField, TextField } from "@/components/ui/field";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { DataRows, Muted, pageStyles } from "@/components/ui/studioPage";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { subscriptionsService } from "@/services/subscriptions.service";
import type { PriceTier } from "@/types/audience.type";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

const intervalOptions = [
  { value: "month", label: "Monthly" },
  { value: "year", label: "Yearly" },
] as const;

function StoreFeeRows({ tier }: { readonly tier: PriceTier }) {
  const web = tier.prices.web;
  const feeShare = (channelPrice: number) => `${Math.round(((channelPrice - web.amountMinor) / channelPrice) * 100)}% store fee`;
  return (
    <DataRows
      rows={[
        { key: "web", label: "Fans on web and Android checkout", detail: "No store fee", value: formatMoneyForDisplay(web) },
        { key: "ios", label: "Fans buying in the iPhone app", detail: `Apple adds its fee; ${feeShare(tier.prices.ios.amountMinor)}`, value: formatMoneyForDisplay(tier.prices.ios) },
        { key: "android", label: "Fans buying in Google Play", detail: `Google adds its fee; ${feeShare(tier.prices.android.amountMinor)}`, value: formatMoneyForDisplay(tier.prices.android) },
      ]}
    />
  );
}

export function NewPlanForm({ currency, onCreated }: { readonly currency: string; readonly onCreated: () => void }) {
  const [interval, setInterval] = useState<"month" | "year">("month");
  const [tierName, setTierName] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [benefits, setBenefits] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const tiers = useQuery({ queryKey: ["price-tiers", currency, interval], queryFn: () => subscriptionsService.listPriceTiers(currency, interval) });
  const chosen = tiers.data?.find((tier) => tier.tier === tierName) ?? tiers.data?.find((tier) => tier.default) ?? tiers.data?.[0];
  const create = useMutation({
    mutationFn: () => subscriptionsService.createPlan({ name: name.trim(), description: description.trim(), price: chosen!.prices.web, interval, benefits: benefits.split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 10) }),
    onSuccess: () => {
      setName("");
      setDescription("");
      setBenefits("");
      onCreated();
    },
    onError: (error) => setFormError(readErrorMessageForDisplay(error)),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    if (create.isPending) return;
    if (!name.trim()) return setFormError("Name the tier, for example Inner circle.");
    if (!chosen) return setFormError("Pick a price.");
    create.mutate();
  }

  if (tiers.isError) return <ErrorState title="Prices didn't load" error={tiers.error} onRetry={() => void tiers.refetch()} />;
  return (
    <form onSubmit={submit} className={pageStyles.page}>
      <SegmentedControl label="Billing" options={intervalOptions} value={interval} onChange={(value) => { setInterval(value); setTierName(null); }} />
      {!tiers.data ? <Skeleton height={48} /> : (
        <SegmentedControl label="Price" options={tiers.data.map((tier) => ({ value: tier.tier, label: formatMoneyForDisplay(tier.prices.web, { showDecimals: false }) }))} value={chosen?.tier ?? ""} onChange={setTierName} />
      )}
      {chosen ? <StoreFeeRows tier={chosen} /> : null}
      <Muted>You earn your subscription share of the web price. In-app prices are raised so the store fee doesn't come out of your share.</Muted>
      <TextField label="Tier name" maxLength={80} value={name} onChange={(event) => setName(event.target.value)} />
      <TextAreaField label="What fans get (one perk per line)" rows={3} value={benefits} onChange={(event) => setBenefits(event.target.value)} />
      <TextAreaField label="Description (optional)" rows={2} maxLength={1000} value={description} onChange={(event) => setDescription(event.target.value)} />
      {formError ? <p className={pageStyles.error} role="alert">{formError}</p> : null}
      <div><Button type="submit" busy={create.isPending}>Publish tier</Button></div>
    </form>
  );
}
