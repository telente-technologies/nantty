"use client";

import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

import type { CurrencyCode } from "@/types/money.type";
import { convertMajorInputToMinorUnits } from "@/utils/money.util";

import styles from "./formFields.module.css";

interface FieldFrameProps {
  readonly label: string;
  readonly hint?: ReactNode;
  readonly errorMessage?: string | null;
  readonly hideLabel?: boolean;
  readonly className?: string;
}

function FieldFrame({ label, hint, errorMessage, hideLabel, className, fieldId, children }: FieldFrameProps & { readonly fieldId: string; readonly children: ReactNode }) {
  return (
    <div className={[styles.field, className ?? ""].join(" ")}>
      <label htmlFor={fieldId} className={hideLabel ? "visuallyHidden" : styles.label}>
        {label}
      </label>
      {children}
      {errorMessage ? (
        <p id={`${fieldId}-error`} className={styles.error} role="alert">
          {errorMessage}
        </p>
      ) : hint ? (
        <p id={`${fieldId}-hint`} className={styles.hint}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(fieldId: string, errorMessage?: string | null, hint?: ReactNode): string | undefined {
  if (errorMessage) return `${fieldId}-error`;
  return hint ? `${fieldId}-hint` : undefined;
}

export function TextField({ label, hint, errorMessage, hideLabel, className, prefix, ...inputProps }: FieldFrameProps & { readonly prefix?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const fieldId = useId();
  return (
    <FieldFrame label={label} hint={hint} errorMessage={errorMessage} hideLabel={hideLabel} className={className} fieldId={fieldId}>
      <div className={[styles.inputShell, errorMessage ? styles.invalid : ""].join(" ")}>
        {prefix ? <span className={styles.prefix}>{prefix}</span> : null}
        <input id={fieldId} className={styles.input} aria-invalid={errorMessage ? true : undefined} aria-describedby={describedBy(fieldId, errorMessage, hint)} {...inputProps} />
      </div>
    </FieldFrame>
  );
}

export function TextAreaField({ label, hint, errorMessage, hideLabel, className, ...textareaProps }: FieldFrameProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const fieldId = useId();
  return (
    <FieldFrame label={label} hint={hint} errorMessage={errorMessage} hideLabel={hideLabel} className={className} fieldId={fieldId}>
      <textarea id={fieldId} className={[styles.textarea, errorMessage ? styles.invalid : ""].join(" ")} aria-invalid={errorMessage ? true : undefined} aria-describedby={describedBy(fieldId, errorMessage, hint)} {...textareaProps} />
    </FieldFrame>
  );
}

export function SelectField({ label, hint, errorMessage, hideLabel, className, options, ...selectProps }: FieldFrameProps & { readonly options: readonly { readonly value: string; readonly label: string }[] } & SelectHTMLAttributes<HTMLSelectElement>) {
  const fieldId = useId();
  return (
    <FieldFrame label={label} hint={hint} errorMessage={errorMessage} hideLabel={hideLabel} className={className} fieldId={fieldId}>
      <select id={fieldId} className={[styles.select, errorMessage ? styles.invalid : ""].join(" ")} aria-invalid={errorMessage ? true : undefined} aria-describedby={describedBy(fieldId, errorMessage, hint)} {...selectProps}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldFrame>
  );
}

export function MoneyField({ label, hint, errorMessage, currency, currencySymbol, valueText, onValueTextChange, onMinorAmountChange, className, ...inputProps }: FieldFrameProps & {
  readonly currency: CurrencyCode;
  readonly currencySymbol?: string;
  readonly valueText: string;
  readonly onValueTextChange: (nextText: string) => void;
  readonly onMinorAmountChange?: (amountMinor: number | null) => void;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "prefix">) {
  return (
    <TextField
      label={label}
      hint={hint}
      errorMessage={errorMessage}
      className={className}
      prefix={currencySymbol ?? currency}
      inputMode="decimal"
      autoComplete="off"
      value={valueText}
      onChange={(event) => {
        const nextText = event.target.value.replace(/[^\d.,]/g, "");
        onValueTextChange(nextText);
        onMinorAmountChange?.(nextText === "" ? null : convertMajorInputToMinorUnits(nextText, currency));
      }}
      {...inputProps}
    />
  );
}

export function ToggleSwitch({ label, description, checked, onCheckedChange, disabled }: { readonly label: string; readonly description?: string; readonly checked: boolean; readonly onCheckedChange: (checked: boolean) => void; readonly disabled?: boolean }) {
  const fieldId = useId();
  return (
    <div className={styles.toggleRow}>
      <div>
        <label htmlFor={fieldId} className={styles.toggleLabel}>
          {label}
        </label>
        {description ? <p className={styles.hint}>{description}</p> : null}
      </div>
      <button id={fieldId} type="button" role="switch" aria-checked={checked} disabled={disabled} className={styles.switch} onClick={() => onCheckedChange(!checked)}>
        <span className={styles.switchThumb} />
      </button>
    </div>
  );
}

export function CheckboxField({ label, checked, onCheckedChange, disabled }: { readonly label: ReactNode; readonly checked: boolean; readonly onCheckedChange: (checked: boolean) => void; readonly disabled?: boolean }) {
  return (
    <label className={styles.checkboxRow}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onCheckedChange(event.target.checked)} className={styles.checkbox} />
      <span>{label}</span>
    </label>
  );
}

export function FormErrorSummary({ messages }: { readonly messages: readonly string[] }) {
  if (messages.length === 0) return null;
  return (
    <div className={styles.errorSummary} role="alert">
      <p>Fix these before saving:</p>
      <ul>
        {messages.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
    </div>
  );
}
