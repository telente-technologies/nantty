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
import { formatMoneyForDisplay } from "@/utils/formatting.util";

import { MoneyAmountField } from "../shared/configurationFields";
import styles from "./regionalPricing.module.css";

type AmountKey = "monthlyAmountMinor" | "yearlyAmountMinor";

const amountFields: readonly { readonly key: AmountKey; readonly label: string }[] = [
  { key: "monthlyAmountMinor", label: "Web monthly" },
  { key: "yearlyAmountMinor", label: "Web yearly (0 = 12 months minus the yearly discount)" },
];

const productKeys: readonly StoreProductKey[] = ["ios.month", "ios.year", "android.month", "android.year"];

function toLocalDateTimeInput(value: Date): string {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

interface PlanPriceRowDialogProps {
  readonly row: PlanPriceRow;
  readonly planLabel: string;
  readonly onClose: () => void;
  readonly onSaved: (row: PlanPriceRow) => void;
}

export function PlanPriceRowDialog({ row, planLabel, onClose, onSaved }: PlanPriceRowDialogProps) {
  const [draft, setDraft] = useState<PlanPriceRow>(row);
  const [effectiveFrom, setEffectiveFrom] = useState(() => {
    const now = Date.now() + 60_000;
    const next = row.nextEffectiveFrom ? Date.parse(row.nextEffectiveFrom) : Number.NaN;
    return toLocalDateTimeInput(new Date(Number.isFinite(next) ? Math.max(now, next) : now));
  });
  const [reason, setReason] = useState("");
  const { showToast } = useToast();
  const save = useAdminMutation((input: { readonly draft: PlanPriceRow; readonly reason: string }) => savePlanPriceRow(input.draft, input.reason));
  const submit = async () => {
    const effectiveDate = new Date(effectiveFrom);
    if (!Number.isFinite(effectiveDate.getTime())) return;
    const saved = await save.run({ draft: { ...draft, effectiveFrom: effectiveDate.toISOString() }, reason });
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
        <TextField
          label="Effective from"
          type="datetime-local"
          value={effectiveFrom}
          min={toLocalDateTimeInput(new Date())}
          onChange={(event) => setEffectiveFrom(event.target.value)}
          hint="Use your local time. Existing and active subscribers keep their current price terms."
        />
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
      <section aria-label="Calculated app-store prices">
        <h3>Calculated in-app prices</h3>
        <p>These are the last saved estimates from the web price and current Apple/Google fee settings. Saving a web price recalculates them. The store product catalog still controls the actual amount charged.</p>
        <ul>
          <li>Apple: {formatMoneyForDisplay({ amountMinor: draft.iosMonthlyAmountMinor, currency: row.currency })} monthly · {formatMoneyForDisplay({ amountMinor: draft.iosYearlyAmountMinor, currency: row.currency })} yearly</li>
          <li>Google Play: {formatMoneyForDisplay({ amountMinor: draft.androidMonthlyAmountMinor, currency: row.currency })} monthly · {formatMoneyForDisplay({ amountMinor: draft.androidYearlyAmountMinor, currency: row.currency })} yearly</li>
        </ul>
      </section>
      <CheckboxField label="Sell this plan in this region" checked={draft.active} onChange={(event) => setDraft((current) => ({ ...current, active: event.target.checked }))} />
      <TextAreaField label="Reason for the change" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={300} />
      <section aria-label="Immutable price history">
        <h3>Price history</h3>
        {row.history?.length ? (
          <ol>
            {[...row.history].reverse().map((version) => (
              <li key={`${version.effectiveFrom}:${version.createdByStaffId}`}>
                <strong>{formatMoneyForDisplay({ amountMinor: version.monthlyAmountMinor, currency: version.currency })} monthly</strong>
                {" · "}{new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(version.effectiveFrom))}
                {" · "}{version.active ? "Active" : "Paused"}{" · "}{version.changeReason}
              </li>
            ))}
          </ol>
        ) : <p>No admin price changes yet. The current legacy price is preserved as the baseline until the first change.</p>}
      </section>
      {save.errorMessage ? <InlineError message={save.errorMessage} /> : null}
    </ModalDialog>
  );
}
