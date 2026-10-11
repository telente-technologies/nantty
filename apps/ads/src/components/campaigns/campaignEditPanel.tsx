"use client";

import { useEffect, useState } from "react";

import { useAdAccount } from "@/components/session/adAccountProvider";
import { Button } from "@/components/ui/button";
import { InlineNotice } from "@/components/ui/feedback";
import { CheckboxField, SegmentedControl, TextField } from "@/components/ui/formFields";
import { OverlayDialog } from "@/components/ui/overlayDialog";
import { useToast } from "@/components/ui/toastProvider";
import { campaignNameMaximumLength } from "@/constants/campaignOptions.constant";
import { campaignsApi } from "@/services/campaignsApi.service";
import { AdsApiRequestError, readErrorMessageForDisplay } from "@/services/adsApiClient.service";
import type { BudgetType, Campaign } from "@/types/campaign.type";
import { formatMajorAmountForInput, parseTypedMajorAmountToMoney, readCurrencySymbol } from "@/utils/money.util";
import { validateRequiredText, type FieldErrors } from "@/utils/formValidation.util";

import { convertIsoTimestampToLocalDateTimeInput, convertLocalDateTimeInputToIsoTimestamp } from "./scheduleInput.util";
import styles from "./detailPages.module.css";

type CampaignField = "name" | "budget" | "spendCap" | "startAt" | "endAt";

interface CampaignEditPanelProps {
  readonly campaign: Campaign;
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSaved: (campaign: Campaign) => void;
}

export function CampaignEditPanel({ campaign, isOpen, onClose, onSaved }: CampaignEditPanelProps) {
  const { accountId, currency } = useAdAccount();
  const { showToast } = useToast();
  const [name, setName] = useState(campaign.name);
  const [budgetType, setBudgetType] = useState<BudgetType>(campaign.budget?.type ?? "daily");
  const [budgetText, setBudgetText] = useState(formatMajorAmountForInput(campaign.budget?.amount));
  const [hasSpendCap, setHasSpendCap] = useState(campaign.spendCap !== null);
  const [spendCapText, setSpendCapText] = useState(formatMajorAmountForInput(campaign.spendCap));
  const [startText, setStartText] = useState(convertIsoTimestampToLocalDateTimeInput(campaign.schedule.startAt));
  const [endText, setEndText] = useState(convertIsoTimestampToLocalDateTimeInput(campaign.schedule.endAt));
  const [errors, setErrors] = useState<FieldErrors<CampaignField>>({});
  const [isSaving, setIsSaving] = useState(false);
  const currencySymbol = readCurrencySymbol(currency);

  useEffect(() => {
    if (!isOpen) return;
    setName(campaign.name);
    setBudgetType(campaign.budget?.type ?? "daily");
    setBudgetText(formatMajorAmountForInput(campaign.budget?.amount));
    setHasSpendCap(campaign.spendCap !== null);
    setSpendCapText(formatMajorAmountForInput(campaign.spendCap));
    setStartText(convertIsoTimestampToLocalDateTimeInput(campaign.schedule.startAt));
    setEndText(convertIsoTimestampToLocalDateTimeInput(campaign.schedule.endAt));
    setErrors({});
  }, [isOpen, campaign]);

  async function validateAndSaveCampaignChanges() {
    const nextErrors: FieldErrors<CampaignField> = { name: validateRequiredText(name, "Campaign name", campaignNameMaximumLength) };
    const budgetAmount = campaign.budgetLevel === "campaign" ? parseTypedMajorAmountToMoney(budgetText, currency) : null;
    if (campaign.budgetLevel === "campaign" && (!budgetAmount || budgetAmount.amountMinor <= 0)) nextErrors.budget = "Enter a budget amount.";
    const spendCap = hasSpendCap ? parseTypedMajorAmountToMoney(spendCapText, currency) : null;
    if (hasSpendCap && (!spendCap || spendCap.amountMinor <= 0)) nextErrors.spendCap = "Enter a spending limit or untick it.";
    const startAt = convertLocalDateTimeInputToIsoTimestamp(startText);
    const endAt = convertLocalDateTimeInputToIsoTimestamp(endText);
    if (!startAt) nextErrors.startAt = "Choose when the campaign starts.";
    if (startAt && endAt && Date.parse(endAt) <= Date.parse(startAt)) nextErrors.endAt = "The end must be after the start.";
    if (budgetType === "lifetime" && campaign.budgetLevel === "campaign" && !endAt) nextErrors.endAt = "A lifetime budget needs an end date.";
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean) || !startAt) return;
    setIsSaving(true);
    try {
      const saved = await campaignsApi.updateCampaign(accountId, campaign.id, {
        name: name.trim(),
        budget: campaign.budgetLevel === "campaign" && budgetAmount ? { type: budgetType, amount: budgetAmount } : null,
        spendCap,
        schedule: { startAt, endAt },
      });
      showToast("Campaign saved.");
      onSaved(saved);
      onClose();
    } catch (error) {
      if (error instanceof AdsApiRequestError && error.issues.length > 0) setErrors({ name: error.issues.find((issue) => issue.path.endsWith("name"))?.message, budget: error.issues.find((issue) => issue.path.includes("budget"))?.message, endAt: error.issues.find((issue) => issue.path.includes("schedule"))?.message });
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <OverlayDialog intent="ads"
      isOpen={isOpen}
      onClose={onClose}
      layout="sidePanel"
      title="Edit campaign"
      description="Changes to budget and dates apply within a few minutes. Delivery keeps running."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" isLoading={isSaving} onClick={validateAndSaveCampaignChanges}>
            Save changes
          </Button>
        </>
      }
    >
      <TextField label="Campaign name" value={name} onValueChange={setName} maxLength={campaignNameMaximumLength} error={errors.name} />
      {campaign.budgetLevel === "campaign" ? (
        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>Campaign budget</span>
          <SegmentedControl<BudgetType> label="Budget type" value={budgetType} onValueChange={setBudgetType} options={[{ value: "daily", label: "Daily" }, { value: "lifetime", label: "Lifetime" }]} />
          <TextField label={budgetType === "daily" ? "Average per day" : "Total for the campaign"} inputMode="decimal" prefix={currencySymbol} value={budgetText} onValueChange={setBudgetText} error={errors.budget} hint="You may spend up to 25% more on busy days, never more than 7× the daily budget in a week." />
        </div>
      ) : (
        <InlineNotice tone="info">Budgets are set on each ad set in this campaign.</InlineNotice>
      )}
      <div className={styles.fieldGroup}>
        <CheckboxField label="Set a campaign spending limit" description="Delivery stops when the campaign has spent this much in total." checked={hasSpendCap} onCheckedChange={setHasSpendCap} />
        {hasSpendCap ? <TextField label="Spending limit" inputMode="decimal" prefix={currencySymbol} value={spendCapText} onValueChange={setSpendCapText} error={errors.spendCap} /> : null}
      </div>
      <div className={styles.formRow}>
        <TextField label="Starts" type="datetime-local" value={startText} onValueChange={setStartText} error={errors.startAt} />
        <TextField label="Ends (optional)" type="datetime-local" value={endText} onValueChange={setEndText} error={errors.endAt} />
      </div>
    </OverlayDialog>
  );
}
