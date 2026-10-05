"use client";

import { useState } from "react";

import { MarketingSectionHeader } from "@/components/marketing/marketingSectionHeader";
import { useSellerSession } from "@/components/session/sellerSessionProvider";
import { StoreSettingsLoadedGate } from "@/components/settings/settingsFormFrame";
import { Button } from "@/components/ui/button";
import { ErrorCallout, StatTile } from "@/components/ui/feedback";
import { FormErrorSummary, MoneyField, TextField, ToggleSwitch } from "@/components/ui/formFields";
import { PageStack, Panel, ResponsiveGrid } from "@/components/ui/panel";
import { useMoneyFormatter } from "@/hooks/useMoneyFormatter.hook";
import { useSellerQuery } from "@/hooks/useSellerQuery.hook";
import { useSettingsPatch } from "@/hooks/useSettingsPatch.hook";
import type { StoreRewardsSummary, StoreSettings } from "@/types/store.type";
import { convertMajorInputToMinorUnits, convertMinorUnitsToMajorInputText } from "@/utils/money.util";

function readWholeNumber(text: string, minimum: number, maximum: number): number | null {
  if (!/^\d{1,7}$/.test(text.trim())) return null;
  const value = Number(text.trim());
  return value >= minimum && value <= maximum ? value : null;
}

function StoreRewardsForm({ settings }: { readonly settings: StoreSettings }) {
  const rules = settings.storeRewards;
  const canEdit = useSellerSession().can("promotions:manage");
  const [isEnabled, setIsEnabled] = useState(rules.enabled);
  const [percentText, setPercentText] = useState(String(rules.percentBackBasisPoints / 100));
  const [minimumOrderText, setMinimumOrderText] = useState(convertMinorUnitsToMajorInputText(rules.minimumOrder.amountMinor, settings.currency));
  const [maxPerOrderText, setMaxPerOrderText] = useState(convertMinorUnitsToMajorInputText(rules.maxPerOrder.amountMinor, settings.currency));
  const [expiryText, setExpiryText] = useState(String(rules.expiryDays));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { isSaving, serverFieldErrors, saveStoreSettingsPatch } = useSettingsPatch();

  async function saveRules() {
    const percent = Number(percentText.trim());
    const minimumOrderMinor = convertMajorInputToMinorUnits(minimumOrderText, settings.currency);
    const maxPerOrderMinor = convertMajorInputToMinorUnits(maxPerOrderText, settings.currency);
    const expiryDays = readWholeNumber(expiryText, 7, 730);
    const nextErrors: Record<string, string> = {};
    if (!Number.isFinite(percent) || percent < 0 || percent > 20) nextErrors.percent = "Enter a percentage from 0 to 20.";
    if (minimumOrderMinor === null) nextErrors.minimumOrder = "Enter a valid minimum order.";
    if (maxPerOrderMinor === null) nextErrors.maxPerOrder = "Enter a valid maximum credit per order.";
    if (expiryDays === null) nextErrors.expiry = "Expiry must be 7 to 730 days.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    await saveStoreSettingsPatch(
      { storeRewards: { enabled: isEnabled, percentBackBasisPoints: Math.round(percent * 100), minimumOrder: { amountMinor: minimumOrderMinor ?? 0, currency: settings.currency }, maxPerOrder: { amountMinor: maxPerOrderMinor ?? 0, currency: settings.currency }, expiryDays: expiryDays ?? 180 } },
      "Store rewards saved.",
    );
  }

  const disabled = !isEnabled || !canEdit;
  return (
    <Panel title="Reward rules" description="You fund these rewards. Customers earn store credit on completed orders and can only spend it as a discount on a future order at your store. It is never cash and cannot be withdrawn.">
      <form onSubmit={(event) => { event.preventDefault(); if (canEdit) void saveRules(); }} noValidate style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <FormErrorSummary messages={[...Object.values(errors), ...Object.values(serverFieldErrors)]} />
        <ToggleSwitch label="Store rewards" description="Credit is added after the order completes and escrow is released, and is taken back if the order is refunded." checked={isEnabled} onCheckedChange={setIsEnabled} disabled={!canEdit} />
        <ResponsiveGrid>
          <TextField label="Credit back (% of order value)" inputMode="decimal" value={percentText} onChange={(event) => setPercentText(event.target.value)} errorMessage={errors.percent} disabled={disabled} />
          <MoneyField label="Minimum order to earn" currency={settings.currency} valueText={minimumOrderText} onValueTextChange={setMinimumOrderText} errorMessage={errors.minimumOrder} disabled={disabled} />
          <MoneyField label="Maximum credit per order" currency={settings.currency} valueText={maxPerOrderText} onValueTextChange={setMaxPerOrderText} errorMessage={errors.maxPerOrder} disabled={disabled} />
          <TextField label="Credit expires after (days)" inputMode="numeric" value={expiryText} onChange={(event) => setExpiryText(event.target.value)} errorMessage={errors.expiry} disabled={disabled} />
        </ResponsiveGrid>
        {canEdit ? <div><Button type="submit" variant="primary" isBusy={isSaving}>Save changes</Button></div> : null}
      </form>
    </Panel>
  );
}

function StoreRewardsLiability() {
  const { formatMoney } = useMoneyFormatter();
  const summary = useSellerQuery<StoreRewardsSummary>("/seller/marketing/rewards/summary");
  if (!summary.data) return summary.errorMessage ? <ErrorCallout message={summary.errorMessage} onRetry={summary.reload} /> : null;
  return (
    <ResponsiveGrid minimumColumnWidth={200}>
      <StatTile label="Outstanding credit" value={formatMoney(summary.data.outstandingLiability)} detail="What you owe customers as discounts" tone="caution" />
      <StatTile label="Customers with credit" value={summary.data.customersWithCredit} />
      <StatTile label="Issued, last 30 days" value={formatMoney(summary.data.issuedLast30Days)} />
      <StatTile label="Redeemed, last 30 days" value={formatMoney(summary.data.redeemedLast30Days)} />
    </ResponsiveGrid>
  );
}

export function StoreRewardsView() {
  return (
    <PageStack>
      <MarketingSectionHeader title="Store rewards" description="Give customers store credit for coming back. You fund it, Zudomart never holds money for it." />
      <StoreRewardsLiability />
      <StoreSettingsLoadedGate>{(settings) => <StoreRewardsForm key={JSON.stringify(settings.storeRewards)} settings={settings} />}</StoreSettingsLoadedGate>
    </PageStack>
  );
}
