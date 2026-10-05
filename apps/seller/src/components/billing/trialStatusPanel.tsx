"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/feedback";
import { KeyValueList, Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/statusBadge";
import { useToast } from "@/components/ui/toastProvider";
import { readErrorMessageForDisplay, sendSellerApiRequest } from "@/services/clientApi.service";
import type { ActiveTrial } from "@/types/billingOffer.type";
import { formatDateForDisplay } from "@/utils/dateFormatting.util";
import { formatMoneyForDisplay } from "@/utils/money.util";

export function TrialReminderCallout({ trial, onCancelled }: { readonly trial: ActiveTrial; readonly onCancelled: () => void }) {
  const { showToast } = useToast();
  const [isCancelling, setIsCancelling] = useState(false);
  if (trial.isCancelled || trial.daysLeft > 3) return null;

  async function cancel() {
    setIsCancelling(true);
    try {
      await sendSellerApiRequest("/seller/subscription/trial/cancel", { method: "POST", body: {} });
      showToast("Trial cancelled. You will not be charged.");
      onCancelled();
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
      setIsCancelling(false);
    }
  }

  return (
    <Callout tone="caution" title={trial.daysLeft <= 1 ? "Your free trial ends tomorrow" : `Your free trial ends in ${trial.daysLeft} days`} action={<Button size="small" isBusy={isCancelling} onClick={() => void cancel()}>Cancel trial</Button>}>
      On {formatDateForDisplay(trial.endsAt)} we will charge {formatMoneyForDisplay(trial.priceAfterTrial)} to {trial.cardSummary}. Cancel before then and you pay nothing.
    </Callout>
  );
}

export function TrialStatusPanel({ trial, onChanged }: { readonly trial: ActiveTrial; readonly onChanged: () => void }) {
  const { showToast } = useToast();
  const [isCancelling, setIsCancelling] = useState(false);

  async function cancel() {
    setIsCancelling(true);
    try {
      await sendSellerApiRequest("/seller/subscription/trial/cancel", { method: "POST", body: {} });
      showToast("Trial cancelled. You keep your plan until the trial ends and will not be charged.");
      onChanged();
    } catch (error) {
      showToast(readErrorMessageForDisplay(error), "error");
    } finally {
      setIsCancelling(false);
    }
  }

  return (
    <Panel title="Your free trial" description="You are trying every feature of your plan. Cancel in one tap at any time." actions={<StatusBadge tone={trial.isCancelled ? "neutral" : "info"}>{trial.isCancelled ? "Cancelled" : `${trial.daysLeft} day${trial.daysLeft === 1 ? "" : "s"} left`}</StatusBadge>}>
      <KeyValueList items={[
        { label: "Trial ends", value: formatDateForDisplay(trial.endsAt) },
        { label: trial.isCancelled ? "Charge after trial" : "First charge", value: trial.isCancelled ? "None" : `${formatMoneyForDisplay(trial.priceAfterTrial)} per ${trial.interval}` },
        { label: "Card", value: trial.cardSummary },
        { label: "Verification charge", value: `${formatMoneyForDisplay(trial.verificationCharge.amount)} ${trial.verificationCharge.status === "REFUNDED" ? "refunded" : "refund on its way"}` },
        ...(trial.reminders?.length ? [{ label: "Reminders", value: trial.reminders.map((reminder) => `${reminder.daysBefore} day${reminder.daysBefore === 1 ? "" : "s"} before (${formatDateForDisplay(reminder.sendsAt)})`).join(" and ") }] : []),
      ]} />
      {!trial.isCancelled ? <div style={{ marginTop: 12 }}><Button variant="danger" isBusy={isCancelling} onClick={() => void cancel()}>Cancel my trial</Button></div> : null}
    </Panel>
  );
}
