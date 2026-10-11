"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/feedback";
import { CheckboxField, TextAreaField, TextField } from "@/components/ui/formFields";
import { ModalDialog } from "@/components/ui/modalDialog";
import { useToast } from "@/components/ui/toastProvider";
import { useAdminMutation } from "@/hooks/useAdminMutation.hook";
import { savePlanPriceRow } from "@/services/pricingApi.service";
import type { PlanPriceRow, StoreProductKey } from "@/types/regionalPricing.type";

import { MoneyAmountField } from "../shared/configurationFields";
import styles from "./regionalPricing.module.css";

type AmountKey = "monthlyAmountMinor" | "yearlyAmountMinor" | "iosMonthlyAmountMinor" | "iosYearlyAmountMinor" | "androidMonthlyAmountMinor" | "androidYearlyAmountMinor";

const amountFields: readonly { readonly key: AmountKey; readonly label: string }[] = [
  { key: "monthlyAmountMinor", label: "Web monthly" },
  { key: "yearlyAmountMinor", label: "Web yearly (0 = 12 months minus the yearly discount)" },
  { key: "iosMonthlyAmountMinor", label: "iOS monthly (0 = not sold in the app)" },
  { key: "iosYearlyAmountMinor", label: "iOS yearly" },
  { key: "androidMonthlyAmountMinor", label: "Android monthly (0 = not sold in the app)" },
  { key: "androidYearlyAmountMinor", label: "Android yearly" },
];

const productKeys: readonly StoreProductKey[] = ["ios.month", "ios.year", "android.month", "android.year"];

interface PlanPriceRowDialogProps {
  readonly row: PlanPriceRow;
  readonly planLabel: string;
  readonly onClose: () => void;
  readonly onSaved: (row: PlanPriceRow) => void;
}

export function PlanPriceRowDialog({ row, planLabel, onClose, onSaved }: PlanPriceRowDialogProps) {
  const [draft, setDraft] = useState<PlanPriceRow>(row);
  const [reason, setReason] = useState("");
  const { showToast } = useToast();
  const save = useAdminMutation((input: { readonly draft: PlanPriceRow; readonly reason: string }) => savePlanPriceRow(input.draft, input.reason));
  const submit = async () => {
    const saved = await save.run({ draft, reason });
    if (!saved) return;
    showToast(`${planLabel} prices in ${row.countryCode} saved.`);
    onSaved(saved);
  };
  return (
    <ModalDialog intent="naira"
      isOpen
      width="wide"
      title={`${planLabel} in ${row.countryCode} (${row.currency})`}
      description="Prices are in the region's own currency. The change is audited with your name and reason."
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" isBusy={save.isRunning} disabled={reason.trim().length < 5 || draft.monthlyAmountMinor <= 0} onClick={() => void submit()}>Save prices</Button>
        </>
      }
    >
      <div className={styles.fieldGrid}>
        {amountFields.map((field) => (
          <MoneyAmountField
            key={field.key}
            label={field.label}
            currency={row.currency}
            money={{ amountMinor: draft[field.key], currency: row.currency }}
            onChange={(money) => setDraft((current) => ({ ...current, [field.key]: money?.amountMinor ?? 0 }))}
          />
        ))}
        {productKeys.map((key) => (
          <TextField
            key={key}
            label={`Store product id (${key})`}
            value={draft.storeProductIds[key] ?? ""}
            onChange={(event) => {
              const value = event.target.value.trim();
              setDraft((current) => {
                const ids = { ...current.storeProductIds };
                if (value) ids[key] = value;
                else delete ids[key];
                return { ...current, storeProductIds: ids };
              });
            }}
          />
        ))}
      </div>
      <CheckboxField label="Sell this plan in this region" checked={draft.active} onChange={(event) => setDraft((current) => ({ ...current, active: event.target.checked }))} />
      <TextAreaField label="Reason for the change" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={300} />
      {save.errorMessage ? <InlineError message={save.errorMessage} /> : null}
    </ModalDialog>
  );
}
