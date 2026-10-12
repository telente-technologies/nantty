"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/feedback";
import { CheckboxField, SelectField, TextAreaField, TextField, readIssueMessageForField } from "@/components/ui/formFields";
import { ModalDialog } from "@/components/ui/modalDialog";
import { useToast } from "@/components/ui/toastProvider";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { createOfferLink } from "@/services/subscriptionOffersApi.service";
import type { Money } from "@/types/api.type";
import type { NewOfferLinkInput, OfferDiscountKind, OfferLink } from "@/types/subscriptionOffers.type";
import { offerPlanOptions } from "@/utils/offerLinkFormat.util";

import { MoneyAmountField } from "../shared/configurationFields";
import styles from "./subscriptionOffers.module.css";

const chargingCurrencies = ["NGN", "GHS", "KES", "ZAR", "GBP", "EUR", "USD"] as const;

interface OfferDraft {
  readonly label: string;
  readonly planCodes: readonly string[];
  readonly discountKind: OfferDiscountKind;
  readonly percentOff: string;
  readonly currency: string;
  readonly amountOff: Money | null;
  readonly singleUse: boolean;
  readonly maxClaims: string;
  readonly isFirstPaymentOnly: boolean;
  readonly durationCycles: string;
  readonly expiresAt: string;
}

const emptyDraft: OfferDraft = {
  label: "", planCodes: [], discountKind: "percentage", percentOff: "20", currency: "NGN", amountOff: null, singleUse: true, maxClaims: "", isFirstPaymentOnly: true, durationCycles: "3", expiresAt: "",
};

function readWholeNumber(text: string): number {
  return /^\d+$/.test(text.trim()) ? Number(text.trim()) : Number.NaN;
}

export function buildOfferLinkInput(draft: OfferDraft): NewOfferLinkInput | string {
  if (draft.planCodes.length === 0) return "Choose at least one plan.";
  const percentOff = readWholeNumber(draft.percentOff);
  if (draft.discountKind === "percentage" && !(percentOff >= 1 && percentOff <= 100)) return "The percentage must be a whole number from 1 to 100.";
  if (draft.discountKind === "fixed_amount" && !(draft.amountOff && draft.amountOff.amountMinor > 0)) return "Enter the amount to take off.";
  const maxClaims = readWholeNumber(draft.maxClaims);
  if (!draft.singleUse && !(maxClaims >= 1)) return "Set how many accounts can claim the link.";
  const durationCycles = draft.isFirstPaymentOnly ? 1 : readWholeNumber(draft.durationCycles);
  if (!(durationCycles >= 1 && durationCycles <= 36)) return "The discount can last from 1 to 36 billing cycles.";
  const expiresAt = draft.expiresAt ? new Date(draft.expiresAt) : null;
  if (expiresAt && !(expiresAt.getTime() > Date.now())) return "The expiry must be in the future.";
  return {
    label: draft.label.trim(), planCodes: draft.planCodes, discountKind: draft.discountKind, singleUse: draft.singleUse, durationCycles,
    ...(draft.discountKind === "percentage" ? { percentOff } : { amountOff: draft.amountOff ?? undefined }),
    ...(draft.singleUse ? {} : { maxClaims }),
    ...(expiresAt ? { expiresAt: expiresAt.toISOString() } : {}),
  };
}

export function CreateOfferLinkDialog({ onClose, onCreated }: { readonly onClose: () => void; readonly onCreated: (link: OfferLink) => void }) {
  const [draft, setDraft] = useState<OfferDraft>(emptyDraft);
  const [reason, setReason] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const { showToast } = useToast();
  const save = useAdminMutation((input: { readonly offer: NewOfferLinkInput; readonly reason: string }) => createOfferLink(input.offer, input.reason));
  const update = (patch: Partial<OfferDraft>) => setDraft((current) => ({ ...current, ...patch }));
  const togglePlan = (planCode: string, isChecked: boolean) =>
    update({ planCodes: isChecked ? [...draft.planCodes, planCode] : draft.planCodes.filter((code) => code !== planCode) });
  const submit = async () => {
    const offer = buildOfferLinkInput(draft);
    if (typeof offer === "string") {
      setLocalError(offer);
      return;
    }
    setLocalError(null);
    const created = await save.run({ offer, reason });
    if (!created) return;
    showToast("Offer link created.");
    onCreated(created);
  };
  const issue = (path: string) => readIssueMessageForField(save.validationIssues, path);
  return (
    <ModalDialog
      isOpen
      width="wide"
      title="New subscription offer link"
      description="The discount only applies to Zudomart plans bought on the web, and only through this link. It never stacks with yearly or bundle discounts; the buyer gets whichever is better."
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" isBusy={save.isRunning} disabled={reason.trim().length < 5} onClick={() => void submit()}>Create link</Button>
        </>
      }
    >
      <div className={styles.form}>
        <TextField label="Internal label (only staff see this)" value={draft.label} maxLength={120} onChange={(event) => update({ label: event.target.value })} error={issue("label")} />
        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Plans</legend>
          <div className={styles.planGrid}>
            {offerPlanOptions.map((option) => (
              <CheckboxField key={option.value} label={option.label} checked={draft.planCodes.includes(option.value)} onChange={(event) => togglePlan(option.value, event.target.checked)} />
            ))}
          </div>
          {issue("planCodes") ? <InlineError message={issue("planCodes")!} /> : null}
        </fieldset>
        <div className={styles.fieldGrid}>
          <SelectField label="Discount" value={draft.discountKind} onChange={(event) => update({ discountKind: event.target.value as OfferDiscountKind })}
            options={[{ value: "percentage", label: "Percentage off" }, { value: "fixed_amount", label: "Fixed amount off" }]} />
          {draft.discountKind === "percentage" ? (
            <TextField label="Percent off (1–100)" inputMode="numeric" value={draft.percentOff} onChange={(event) => update({ percentOff: event.target.value })} error={issue("percentOff")} />
          ) : (
            <div className={styles.moneyRow}>
              <SelectField label="Currency" value={draft.currency} onChange={(event) => update({ currency: event.target.value, amountOff: null })} options={chargingCurrencies.map((code) => ({ value: code, label: code }))} />
              <MoneyAmountField label="Amount off" currency={draft.currency} money={draft.amountOff} onChange={(money) => update({ amountOff: money })} />
            </div>
          )}
        </div>
        {draft.discountKind === "fixed_amount" ? <p className={styles.note}>Buyers charged in another currency can&apos;t use a fixed amount offer, and the offer page tells them why.</p> : null}
        <CheckboxField label="Single use" description="Only the first account to claim it gets the offer." checked={draft.singleUse} onChange={(event) => update({ singleUse: event.target.checked })} />
        {draft.singleUse ? null : (
          <TextField label="Most accounts that can claim it" inputMode="numeric" value={draft.maxClaims} onChange={(event) => update({ maxClaims: event.target.value })} error={issue("maxClaims")} />
        )}
        <div className={styles.fieldGrid}>
          <SelectField label="Discount lasts for" value={draft.isFirstPaymentOnly ? "first" : "cycles"} onChange={(event) => update({ isFirstPaymentOnly: event.target.value === "first" })}
            options={[{ value: "first", label: "First payment only" }, { value: "cycles", label: "Several billing cycles" }]} />
          {draft.isFirstPaymentOnly ? null : (
            <TextField label="Billing cycles (1–36)" inputMode="numeric" value={draft.durationCycles} onChange={(event) => update({ durationCycles: event.target.value })} error={issue("durationCycles")} />
          )}
        </div>
        <TextField label="Expires (optional)" type="datetime-local" value={draft.expiresAt} onChange={(event) => update({ expiresAt: event.target.value })} error={issue("expiresAt")} />
        <TextAreaField label="Reason (saved to the audit log)" value={reason} maxLength={300} onChange={(event) => setReason(event.target.value)} />
        {localError ? <InlineError message={localError} /> : null}
        {save.errorMessage ? <InlineError message={save.errorMessage} /> : null}
      </div>
    </ModalDialog>
  );
}
