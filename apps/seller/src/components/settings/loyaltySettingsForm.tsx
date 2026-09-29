"use client";

import { useState } from "react";

import { SettingsFormFrame, StoreSettingsLoadedGate } from "@/components/settings/settingsFormFrame";
import { MoneyField, TextField, ToggleSwitch } from "@/components/ui/formFields";
import { useSettingsPatch } from "@/hooks/useSettingsPatch.hook";
import type { StoreSettings } from "@/types/store.type";
import { convertMajorInputToMinorUnits, convertMinorUnitsToMajorInputText } from "@/utils/money.util";
import { convertBasisPointsToPercentText, convertPercentTextToBasisPoints } from "@/utils/settingsPercent.util";

import styles from "./settings.module.css";

function readWholeNumber(text: string, maximum: number): number | null {
  if (!/^\d{1,7}$/.test(text.trim())) return null;
  const value = Number(text.trim());
  return value <= maximum ? value : null;
}

function LoyaltyAndDiscountForm({ settings }: { readonly settings: StoreSettings }) {
  const [isLoyaltyEnabled, setIsLoyaltyEnabled] = useState(settings.loyalty.enabled);
  const [pointsPerUnitText, setPointsPerUnitText] = useState(convertMinorUnitsToMajorInputText(settings.loyalty.spendRequiredPerPoint.amountMinor, settings.currency));
  const [pointValueText, setPointValueText] = useState(convertMinorUnitsToMajorInputText(settings.loyalty.redeemValuePerPoint.amountMinor, settings.currency));
  const [minimumPointsText, setMinimumPointsText] = useState(String(settings.loyalty.minimumPointsToRedeem));
  const [thresholdText, setThresholdText] = useState(convertBasisPointsToPercentText(settings.discountApprovalThresholdBasisPoints));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const { isSaving, serverFieldErrors, saveStoreSettingsPatch } = useSettingsPatch();

  async function saveLoyaltyAndDiscountRules() {
    const spendRequiredMinor = convertMajorInputToMinorUnits(pointsPerUnitText, settings.currency);
    const redeemValueMinor = convertMajorInputToMinorUnits(pointValueText, settings.currency);
    const minimumPointsToRedeem = readWholeNumber(minimumPointsText, 1_000_000);
    const thresholdBasisPoints = convertPercentTextToBasisPoints(thresholdText);
    const errors: Record<string, string> = {};
    if (spendRequiredMinor === null || spendRequiredMinor < 1 || spendRequiredMinor > 100_000_000) errors.points = "Enter how much a customer spends to earn one point.";
    if (redeemValueMinor === null || redeemValueMinor > 10_000_000) errors.pointValue = "Enter what one point is worth.";
    if (minimumPointsToRedeem === null) errors.minimum = "Minimum points must be a whole number.";
    if (thresholdBasisPoints === null) errors.threshold = "Enter a percentage between 0 and 100.";
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    await saveStoreSettingsPatch(
      {
        loyalty: { enabled: isLoyaltyEnabled, spendRequiredPerPoint: { amountMinor: spendRequiredMinor ?? 1, currency: settings.currency }, redeemValuePerPoint: { amountMinor: redeemValueMinor ?? 0, currency: settings.currency }, minimumPointsToRedeem: minimumPointsToRedeem ?? 0 },
        discountApprovalThresholdBasisPoints: thresholdBasisPoints ?? 0,
      },
      "Loyalty and discount rules saved.",
    );
  }

  return (
    <SettingsFormFrame title="Loyalty & discounts" description="How customers earn and spend points, and when cashiers need a manager for a discount." errorMessages={[...Object.values(fieldErrors), ...Object.values(serverFieldErrors)]} isSaving={isSaving} onSubmit={() => void saveLoyaltyAndDiscountRules()}>
      <ToggleSwitch label="Loyalty points" description="Customers linked to a sale earn points they can spend at the register." checked={isLoyaltyEnabled} onCheckedChange={setIsLoyaltyEnabled} />
      <div className={styles.twoColumns}>
        <MoneyField label="Spend needed to earn 1 point" currency={settings.currency} valueText={pointsPerUnitText} onValueTextChange={setPointsPerUnitText} errorMessage={fieldErrors.points} disabled={!isLoyaltyEnabled} />
        <MoneyField label="Value of one point" currency={settings.currency} valueText={pointValueText} onValueTextChange={setPointValueText} errorMessage={fieldErrors.pointValue} disabled={!isLoyaltyEnabled} />
        <TextField label="Points needed before redeeming" inputMode="numeric" value={minimumPointsText} onChange={(event) => setMinimumPointsText(event.target.value)} errorMessage={fieldErrors.minimum} disabled={!isLoyaltyEnabled} />
      </div>
      <TextField
        label="Manager approval above this discount (%)"
        inputMode="decimal"
        value={thresholdText}
        maxLength={6}
        onChange={(event) => setThresholdText(event.target.value)}
        errorMessage={fieldErrors.threshold}
        hint="Line or cart discounts bigger than this share of the price need a manager's PIN at the register."
      />
    </SettingsFormFrame>
  );
}

export function LoyaltySettingsView() {
  return <StoreSettingsLoadedGate>{(settings) => <LoyaltyAndDiscountForm key={JSON.stringify(settings.loyalty) + settings.discountApprovalThresholdBasisPoints} settings={settings} />}</StoreSettingsLoadedGate>;
}
