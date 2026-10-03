"use client";

import { useState } from "react";

import { SettingsFormFrame, StoreSettingsLoadedGate } from "@/components/settings/settingsFormFrame";
import { MoneyField, TextField, ToggleSwitch } from "@/components/ui/formFields";
import { useSettingsPatch } from "@/hooks/useSettingsPatch.hook";
import type { StoreSettings } from "@/types/store.type";
import { convertMajorInputToMinorUnits, convertMinorUnitsToMajorInputText } from "@/utils/money.util";

import styles from "./settings.module.css";

function readWholeNumber(text: string, maximum: number): number | null {
  if (!/^\d{1,7}$/.test(text.trim())) return null;
  const value = Number(text.trim());
  return value <= maximum ? value : null;
}

function LoyaltyPointsForm({ settings }: { readonly settings: StoreSettings }) {
  const [isLoyaltyEnabled, setIsLoyaltyEnabled] = useState(settings.loyalty.enabled);
  const [pointsPerUnitText, setPointsPerUnitText] = useState(convertMinorUnitsToMajorInputText(settings.loyalty.spendRequiredPerPoint.amountMinor, settings.currency));
  const [pointValueText, setPointValueText] = useState(convertMinorUnitsToMajorInputText(settings.loyalty.redeemValuePerPoint.amountMinor, settings.currency));
  const [minimumPointsText, setMinimumPointsText] = useState(String(settings.loyalty.minimumPointsToRedeem));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const { isSaving, serverFieldErrors, saveStoreSettingsPatch } = useSettingsPatch();

  async function saveLoyaltyPointsRules() {
    const spendRequiredMinor = convertMajorInputToMinorUnits(pointsPerUnitText, settings.currency);
    const redeemValueMinor = convertMajorInputToMinorUnits(pointValueText, settings.currency);
    const minimumPointsToRedeem = readWholeNumber(minimumPointsText, 1_000_000);
    const errors: Record<string, string> = {};
    if (spendRequiredMinor === null || spendRequiredMinor < 1 || spendRequiredMinor > 100_000_000) errors.points = "Enter how much a customer spends to earn one point.";
    if (redeemValueMinor === null || redeemValueMinor > 10_000_000) errors.pointValue = "Enter what one point is worth.";
    if (minimumPointsToRedeem === null) errors.minimum = "Minimum points must be a whole number.";
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    await saveStoreSettingsPatch(
      {
        loyalty: { enabled: isLoyaltyEnabled, spendRequiredPerPoint: { amountMinor: spendRequiredMinor ?? 1, currency: settings.currency }, redeemValuePerPoint: { amountMinor: redeemValueMinor ?? 0, currency: settings.currency }, minimumPointsToRedeem: minimumPointsToRedeem ?? 0 },
      },
      "Loyalty rules saved.",
    );
  }

  return (
    <SettingsFormFrame title="Loyalty" description="How customers earn points on app orders and spend them at checkout." errorMessages={[...Object.values(fieldErrors), ...Object.values(serverFieldErrors)]} isSaving={isSaving} onSubmit={() => void saveLoyaltyPointsRules()}>
      <ToggleSwitch label="Loyalty points" description="Customers earn points on delivered orders and can spend them on their next order in the Zudomart app." checked={isLoyaltyEnabled} onCheckedChange={setIsLoyaltyEnabled} />
      <div className={styles.twoColumns}>
        <MoneyField label="Spend needed to earn 1 point" currency={settings.currency} valueText={pointsPerUnitText} onValueTextChange={setPointsPerUnitText} errorMessage={fieldErrors.points} disabled={!isLoyaltyEnabled} />
        <MoneyField label="Value of one point" currency={settings.currency} valueText={pointValueText} onValueTextChange={setPointValueText} errorMessage={fieldErrors.pointValue} disabled={!isLoyaltyEnabled} />
        <TextField label="Points needed before redeeming" inputMode="numeric" value={minimumPointsText} onChange={(event) => setMinimumPointsText(event.target.value)} errorMessage={fieldErrors.minimum} disabled={!isLoyaltyEnabled} />
      </div>
    </SettingsFormFrame>
  );
}

export function LoyaltySettingsView() {
  return <StoreSettingsLoadedGate>{(settings) => <LoyaltyPointsForm key={JSON.stringify(settings.loyalty)} settings={settings} />}</StoreSettingsLoadedGate>;
}
