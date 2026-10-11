"use client";

import { useEffect, useState } from "react";

import { useAdAccount } from "@/components/session/adAccountProvider";
import { Button } from "@/components/ui/button";
import { CheckboxField, SelectField, TextField } from "@/components/ui/formFields";
import { OverlayDialog } from "@/components/ui/overlayDialog";
import { useToast } from "@/components/ui/toastProvider";
import { bidStrategyOptions, campaignNameMaximumLength } from "@/constants/campaignOptions.constant";
import { campaignsApi } from "@/services/campaignsApi.service";
import { readErrorMessageForDisplay } from "@/services/adsApiClient.service";
import type { AdSet, BidStrategyType } from "@/types/campaign.type";
import { validateRequiredText, type FieldErrors } from "@/utils/formValidation.util";
import { formatMajorAmountForInput, parseTypedMajorAmountToMoney, readCurrencySymbol } from "@/utils/money.util";

import { convertIsoTimestampToLocalDateTimeInput, convertLocalDateTimeInputToIsoTimestamp } from "./scheduleInput.util";
import styles from "./detailPages.module.css";

type AdSetField = "name" | "budget" | "bid" | "frequency" | "endAt";

interface AdSetEditPanelProps {
  readonly adSet: AdSet;
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSaved: () => void;
}

export function AdSetEditPanel({ adSet, isOpen, onClose, onSaved }: AdSetEditPanelProps) {
  const { accountId, currency } = useAdAccount();
  const { showToast } = useToast();
  const [name, setName] = useState(adSet.name);
  const [budgetText, setBudgetText] = useState(formatMajorAmountForInput(adSet.budget?.amount));
  const [bidType, setBidType] = useState<BidStrategyType>(adSet.bidStrategy.type);
  const [bidText, setBidText] = useState(formatMajorAmountForInput(adSet.bidStrategy.amount));
  const [hasFrequencyCap, setHasFrequencyCap] = useState(adSet.frequencyCap !== null);
  const [capImpressionsText, setCapImpressionsText] = useState(String(adSet.frequencyCap?.impressions ?? 3));
  const [capDaysText, setCapDaysText] = useState(String(adSet.frequencyCap?.perDays ?? 7));
  const [endText, setEndText] = useState(convertIsoTimestampToLocalDateTimeInput(adSet.schedule.endAt));
  const [errors, setErrors] = useState<FieldErrors<AdSetField>>({});
  const [isSaving, setIsSaving] = useState(false);
  const currencySymbol = readCurrencySymbol(currency);
  const selectedBidOption = bidStrategyOptions.find((option) => option.type === bidType);

  useEffect(() => {
    if (!isOpen) return;
    setName(adSet.name);
    setBudgetText(formatMajorAmountForInput(adSet.budget?.amount));
    setBidType(adSet.bidStrategy.type);
    setBidText(formatMajorAmountForInput(adSet.bidStrategy.amount));
    setHasFrequencyCap(adSet.frequencyCap !== null);
    setEndText(convertIsoTimestampToLocalDateTimeInput(adSet.schedule.endAt));
    setErrors({});
  }, [isOpen, adSet]);

  async function validateAndSaveAdSetChanges() {
    const nextErrors: FieldErrors<AdSetField> = { name: validateRequiredText(name, "Ad set name", campaignNameMaximumLength) };
    const budgetAmount = adSet.budget ? parseTypedMajorAmountToMoney(budgetText, currency) : null;
    if (adSet.budget && (!budgetAmount || budgetAmount.amountMinor <= 0)) nextErrors.budget = "Enter a budget amount.";
    const bidAmount = selectedBidOption?.needsAmount ? parseTypedMajorAmountToMoney(bidText, currency) : null;
    if (selectedBidOption?.needsAmount && (!bidAmount || bidAmount.amountMinor <= 0)) nextErrors.bid = "Enter the bid amount.";
    const capImpressions = Number(capImpressionsText);
    const capDays = Number(capDaysText);
    if (hasFrequencyCap && (!Number.isInteger(capImpressions) || capImpressions < 1 || capImpressions > 20 || !Number.isInteger(capDays) || capDays < 1 || capDays > 30)) nextErrors.frequency = "Use 1–20 impressions per 1–30 days.";
    const endAt = convertLocalDateTimeInputToIsoTimestamp(endText);
    if (endAt && Date.parse(endAt) <= Date.parse(adSet.schedule.startAt)) nextErrors.endAt = "The end must be after the start.";
    if (adSet.budget?.type === "lifetime" && !endAt) nextErrors.endAt = "A lifetime budget needs an end date.";
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;
    setIsSaving(true);
    try {
      await campaignsApi.updateAdSet(accountId, adSet.id, {
        name: name.trim(),
        budget: adSet.budget && budgetAmount ? { type: adSet.budget.type, amount: budgetAmount } : null,
        bidStrategy: { type: bidType, amount: bidAmount },
        frequencyCap: hasFrequencyCap ? { impressions: capImpressions, perDays: capDays } : null,
        schedule: { startAt: adSet.schedule.startAt, endAt },
      });
      showToast("Ad set saved.");
      onSaved();
      onClose();
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <OverlayDialog intent="audience"
      isOpen={isOpen}
      onClose={onClose}
      layout="sidePanel"
      title="Edit ad set"
      description="To change who sees your ads, duplicate this ad set and edit the copy, so results stay comparable."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" isLoading={isSaving} onClick={validateAndSaveAdSetChanges}>
            Save changes
          </Button>
        </>
      }
    >
      <TextField label="Ad set name" value={name} onValueChange={setName} maxLength={campaignNameMaximumLength} error={errors.name} />
      {adSet.budget ? (
        <TextField label={adSet.budget.type === "daily" ? "Daily budget" : "Lifetime budget"} inputMode="decimal" prefix={currencySymbol} value={budgetText} onValueChange={setBudgetText} error={errors.budget} />
      ) : null}
      <div className={styles.fieldGroup}>
        <SelectField<BidStrategyType> label="Bid strategy" value={bidType} onValueChange={setBidType} options={bidStrategyOptions.map((option) => ({ value: option.type, label: option.label }))} hint={selectedBidOption?.description} />
        {selectedBidOption?.needsAmount ? <TextField label="Bid amount" inputMode="decimal" prefix={currencySymbol} value={bidText} onValueChange={setBidText} error={errors.bid} /> : null}
      </div>
      <div className={styles.fieldGroup}>
        <CheckboxField label="Limit how often each person sees these ads" checked={hasFrequencyCap} onCheckedChange={setHasFrequencyCap} />
        {hasFrequencyCap ? (
          <div className={styles.formRow}>
            <TextField label="Impressions" inputMode="numeric" value={capImpressionsText} onValueChange={setCapImpressionsText} error={errors.frequency} />
            <TextField label="Every (days)" inputMode="numeric" value={capDaysText} onValueChange={setCapDaysText} />
          </div>
        ) : null}
      </div>
      <TextField label="Ends (optional)" type="datetime-local" value={endText} onValueChange={setEndText} error={errors.endAt} />
    </OverlayDialog>
  );
}
