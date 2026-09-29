"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/formFields";
import type { Money } from "@/types/api.type";
import { formatMajorAmountForInput, parseTypedMajorAmountToMoney } from "@/utils/formatting.util";

import styles from "./configurationFields.module.css";

interface NumericFieldProps {
  readonly label: string;
  readonly hint?: string;
  readonly isDisabled?: boolean;
}

export function BasisPointsField({ label, hint, basisPoints, maximumBasisPoints = 10_000, isDisabled, onChange }: NumericFieldProps & { readonly basisPoints: number; readonly maximumBasisPoints?: number; readonly onChange: (basisPoints: number) => void }) {
  return (
    <TextField
      label={`${label} (%)`}
      hint={hint}
      type="number"
      min={0}
      max={maximumBasisPoints / 100}
      step={0.01}
      value={String(basisPoints / 100)}
      disabled={isDisabled}
      onChange={(event) => {
        const percent = Number(event.target.value);
        if (!Number.isNaN(percent)) onChange(Math.min(maximumBasisPoints, Math.max(0, Math.round(percent * 100))));
      }}
    />
  );
}

export function WholeNumberField({ label, hint, value, minimum = 0, maximum, isDisabled, onChange }: NumericFieldProps & { readonly value: number; readonly minimum?: number; readonly maximum?: number; readonly onChange: (value: number) => void }) {
  return (
    <TextField
      label={label}
      hint={hint}
      type="number"
      min={minimum}
      max={maximum}
      step={1}
      value={String(value)}
      disabled={isDisabled}
      onChange={(event) => {
        const parsed = Math.round(Number(event.target.value));
        if (!Number.isNaN(parsed)) onChange(Math.max(minimum, maximum === undefined ? parsed : Math.min(maximum, parsed)));
      }}
    />
  );
}

export function MoneyAmountField({ label, money, currency, isDisabled, isLabelHidden, onChange }: { readonly label: string; readonly money: Money | null; readonly currency: string; readonly isDisabled?: boolean; readonly isLabelHidden?: boolean; readonly onChange: (money: Money | null) => void }) {
  const [typedText, setTypedText] = useState(formatMajorAmountForInput(money));
  useEffect(() => setTypedText((current) => (parseTypedMajorAmountToMoney(current, currency)?.amountMinor === money?.amountMinor ? current : formatMajorAmountForInput(money))), [money, currency]);
  const isInvalid = typedText.trim() !== "" && parseTypedMajorAmountToMoney(typedText, currency) === null;
  return (
    <TextField
      label={label}
      isLabelHidden={isLabelHidden}
      inputMode="decimal"
      value={typedText}
      disabled={isDisabled}
      placeholder="—"
      error={isInvalid ? "Enter an amount like 4500 or 4500.50" : null}
      onChange={(event) => {
        setTypedText(event.target.value);
        if (event.target.value.trim() === "") return onChange(null);
        const parsed = parseTypedMajorAmountToMoney(event.target.value, currency);
        if (parsed) onChange(parsed);
      }}
    />
  );
}

export function MoneyPerCurrencyEditor({ label, amounts, supportedCurrencies, isDisabled, onChange }: { readonly label: string; readonly amounts: readonly Money[]; readonly supportedCurrencies: readonly string[]; readonly isDisabled?: boolean; readonly onChange: (amounts: Money[]) => void }) {
  const unusedCurrencies = supportedCurrencies.filter((currency) => !amounts.some((amount) => amount.currency === currency));
  const [currencyToAdd, setCurrencyToAdd] = useState(unusedCurrencies[0] ?? "");
  const selectedCurrencyToAdd = unusedCurrencies.includes(currencyToAdd) ? currencyToAdd : (unusedCurrencies[0] ?? "");
  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>{label}</legend>
      {amounts.map((amount) => (
        <div key={amount.currency} className={styles.moneyRow}>
          <span className={styles.currencyCode}>{amount.currency}</span>
          <MoneyAmountField label={`${label} in ${amount.currency}`} isLabelHidden money={amount} currency={amount.currency} isDisabled={isDisabled} onChange={(money) => onChange(amounts.map((candidate) => (candidate.currency === amount.currency ? (money ?? { amountMinor: 0, currency: amount.currency }) : candidate)))} />
          {!isDisabled ? (
            <Button size="small" variant="ghost" iconName="trash24" aria-label={`Remove ${amount.currency}`} onClick={() => onChange(amounts.filter((candidate) => candidate.currency !== amount.currency))} />
          ) : null}
        </div>
      ))}
      {!isDisabled && unusedCurrencies.length > 0 ? (
        <div className={styles.moneyRow}>
          <SelectField label="Currency to add" isLabelHidden value={selectedCurrencyToAdd} onChange={(event) => setCurrencyToAdd(event.target.value)} options={unusedCurrencies.map((currency) => ({ value: currency, label: currency }))} />
          <Button size="small" iconName="plus16" onClick={() => onChange([...amounts, { amountMinor: 0, currency: selectedCurrencyToAdd }])}>
            Add {selectedCurrencyToAdd}
          </Button>
        </div>
      ) : null}
    </fieldset>
  );
}

export function EditableTextList({ label, items, placeholder, maximumLength = 120, isDisabled, onChange }: { readonly label: string; readonly items: readonly string[]; readonly placeholder: string; readonly maximumLength?: number; readonly isDisabled?: boolean; readonly onChange: (items: string[]) => void }) {
  const [newItemText, setNewItemText] = useState("");
  function addTypedItem() {
    const trimmed = newItemText.trim();
    if (!trimmed || items.includes(trimmed)) return;
    onChange([...items, trimmed]);
    setNewItemText("");
  }
  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>{label}</legend>
      <ul className={styles.textList}>
        {items.map((item, index) => (
          <li key={item} className={styles.textListItem}>
            {isDisabled ? (
              <span>{item}</span>
            ) : (
              <TextField label={`${label} ${index + 1}`} isLabelHidden value={item} maxLength={maximumLength} onChange={(event) => onChange(items.map((candidate, candidateIndex) => (candidateIndex === index ? event.target.value : candidate)))} />
            )}
            {!isDisabled ? <Button size="small" variant="ghost" iconName="trash24" aria-label={`Remove ${item}`} onClick={() => onChange(items.filter((_, candidateIndex) => candidateIndex !== index))} /> : null}
          </li>
        ))}
      </ul>
      {!isDisabled ? (
        <div className={styles.moneyRow}>
          <TextField label={`New ${label.toLowerCase()}`} isLabelHidden placeholder={placeholder} value={newItemText} maxLength={maximumLength} onChange={(event) => setNewItemText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addTypedItem(); } }} />
          <Button size="small" iconName="plus16" onClick={addTypedItem} disabled={!newItemText.trim()}>
            Add
          </Button>
        </div>
      ) : null}
    </fieldset>
  );
}
