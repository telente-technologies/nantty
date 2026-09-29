"use client";

import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

import styles from "./formFields.module.css";

interface FieldShellProps {
  readonly label: string;
  readonly hint?: ReactNode;
  readonly error?: string;
  readonly children: (controlProps: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) => ReactNode;
  readonly className?: string;
  readonly hideLabel?: boolean;
  readonly trailingLabel?: ReactNode;
}

export function FieldShell({ label, hint, error, children, className, hideLabel, trailingLabel }: FieldShellProps) {
  const controlId = useId();
  const hintId = `${controlId}-hint`;
  const errorId = `${controlId}-error`;
  const describedBy = [hint ? hintId : "", error ? errorId : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div className={[styles.field, className ?? ""].join(" ")}>
      <div className={hideLabel ? "visuallyHidden" : styles.labelRow}>
        <label htmlFor={controlId} className={styles.label}>
          {label}
        </label>
        {trailingLabel}
      </div>
      {children({ id: controlId, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {hint && !error ? (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  readonly label: string;
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly hint?: ReactNode;
  readonly error?: string;
  readonly prefix?: string;
  readonly suffix?: string;
  readonly hideLabel?: boolean;
  readonly fieldClassName?: string;
}

export function TextField({ label, value, onValueChange, hint, error, prefix, suffix, hideLabel, fieldClassName, ...inputAttributes }: TextFieldProps) {
  return (
    <FieldShell label={label} hint={hint} error={error} hideLabel={hideLabel} className={fieldClassName}>
      {(controlProps) => (
        <div className={[styles.inputFrame, error ? styles.invalid : ""].join(" ")}>
          {prefix ? <span className={styles.affix}>{prefix}</span> : null}
          <input {...inputAttributes} {...controlProps} className={styles.input} value={value} onChange={(event) => onValueChange(event.target.value)} />
          {suffix ? <span className={styles.affix}>{suffix}</span> : null}
        </div>
      )}
    </FieldShell>
  );
}

interface TextAreaFieldProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange" | "value"> {
  readonly label: string;
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly hint?: ReactNode;
  readonly error?: string;
  readonly maximumLength?: number;
}

export function TextAreaField({ label, value, onValueChange, hint, error, maximumLength, ...textareaAttributes }: TextAreaFieldProps) {
  const counter = maximumLength ? (
    <span className={value.length > maximumLength ? styles.counterOver : styles.counter}>
      {value.length}/{maximumLength}
    </span>
  ) : null;
  return (
    <FieldShell label={label} hint={hint} error={error} trailingLabel={counter}>
      {(controlProps) => (
        <textarea {...textareaAttributes} {...controlProps} className={[styles.textarea, error ? styles.invalid : ""].join(" ")} value={value} onChange={(event) => onValueChange(event.target.value)} />
      )}
    </FieldShell>
  );
}

interface SelectFieldProps<Value extends string> extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange" | "value"> {
  readonly label: string;
  readonly value: Value;
  readonly onValueChange: (value: Value) => void;
  readonly options: readonly { readonly value: Value; readonly label: string }[];
  readonly hint?: ReactNode;
  readonly error?: string;
  readonly hideLabel?: boolean;
  readonly fieldClassName?: string;
}

export function SelectField<Value extends string>({ label, value, onValueChange, options, hint, error, hideLabel, fieldClassName, ...selectAttributes }: SelectFieldProps<Value>) {
  return (
    <FieldShell label={label} hint={hint} error={error} hideLabel={hideLabel} className={fieldClassName}>
      {(controlProps) => (
        <select {...selectAttributes} {...controlProps} className={[styles.select, error ? styles.invalid : ""].join(" ")} value={value} onChange={(event) => onValueChange(event.target.value as Value)}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </FieldShell>
  );
}

interface CheckboxFieldProps {
  readonly label: ReactNode;
  readonly checked: boolean;
  readonly onCheckedChange: (checked: boolean) => void;
  readonly description?: ReactNode;
  readonly disabled?: boolean;
}

export function CheckboxField({ label, checked, onCheckedChange, description, disabled }: CheckboxFieldProps) {
  return (
    <label className={[styles.checkboxRow, disabled ? styles.disabledRow : ""].join(" ")}>
      <input type="checkbox" className={styles.checkbox} checked={checked} disabled={disabled} onChange={(event) => onCheckedChange(event.target.checked)} />
      <span>
        <span className={styles.checkboxLabel}>{label}</span>
        {description ? <span className={styles.checkboxDescription}>{description}</span> : null}
      </span>
    </label>
  );
}

interface SwitchToggleProps {
  readonly label: string;
  readonly checked: boolean;
  readonly onCheckedChange: (checked: boolean) => void;
  readonly disabled?: boolean;
  readonly hideLabel?: boolean;
}

export function SwitchToggle({ label, checked, onCheckedChange, disabled, hideLabel }: SwitchToggleProps) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={hideLabel ? label : undefined} disabled={disabled} className={styles.switchButton} onClick={() => onCheckedChange(!checked)}>
      <span className={checked ? `${styles.switchTrack} ${styles.switchOn}` : styles.switchTrack}>
        <span className={styles.switchThumb} />
      </span>
      {hideLabel ? null : <span>{label}</span>}
    </button>
  );
}

interface SegmentedControlProps<Value extends string> {
  readonly label: string;
  readonly value: Value;
  readonly onValueChange: (value: Value) => void;
  readonly options: readonly { readonly value: Value; readonly label: string }[];
}

export function SegmentedControl<Value extends string>({ label, value, onValueChange, options }: SegmentedControlProps<Value>) {
  return (
    <div role="radiogroup" aria-label={label} className={styles.segmented}>
      {options.map((option) => (
        <button key={option.value} type="button" role="radio" aria-checked={option.value === value} className={option.value === value ? `${styles.segment} ${styles.segmentOn}` : styles.segment} onClick={() => onValueChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}
