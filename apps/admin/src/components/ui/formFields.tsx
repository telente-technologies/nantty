"use client";

import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

import styles from "./formFields.module.css";

interface FieldFrameProps {
  readonly label: string;
  readonly hint?: ReactNode;
  readonly error?: string | null;
  readonly isLabelHidden?: boolean;
  readonly fieldId: string;
  readonly children: ReactNode;
  readonly className?: string;
}

function FieldFrame({ label, hint, error, isLabelHidden, fieldId, children, className }: FieldFrameProps) {
  return (
    <div className={className ? `${styles.field} ${className}` : styles.field}>
      <label htmlFor={fieldId} className={isLabelHidden ? "visuallyHidden" : styles.label}>
        {label}
      </label>
      {children}
      {hint && !error ? <p id={`${fieldId}-hint`} className={styles.hint}>{hint}</p> : null}
      {error ? <p id={`${fieldId}-error`} className={styles.error} role="alert">{error}</p> : null}
    </div>
  );
}

function describedBy(fieldId: string, hint: ReactNode, error: string | null | undefined): string | undefined {
  if (error) return `${fieldId}-error`;
  return hint ? `${fieldId}-hint` : undefined;
}

type SharedFieldProps = Omit<FieldFrameProps, "fieldId" | "children">;

export function TextField({ label, hint, error, isLabelHidden, className, id, ...inputProps }: SharedFieldProps & InputHTMLAttributes<HTMLInputElement>) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  return (
    <FieldFrame label={label} hint={hint} error={error} isLabelHidden={isLabelHidden} fieldId={fieldId} className={className}>
      <input id={fieldId} className={styles.input} aria-invalid={error ? true : undefined} aria-describedby={describedBy(fieldId, hint, error)} {...inputProps} />
    </FieldFrame>
  );
}

export function TextAreaField({ label, hint, error, isLabelHidden, className, id, ...textAreaProps }: SharedFieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  return (
    <FieldFrame label={label} hint={hint} error={error} isLabelHidden={isLabelHidden} fieldId={fieldId} className={className}>
      <textarea id={fieldId} className={`${styles.input} ${styles.textArea}`} aria-invalid={error ? true : undefined} aria-describedby={describedBy(fieldId, hint, error)} {...textAreaProps} />
    </FieldFrame>
  );
}

export interface SelectOption {
  readonly value: string;
  readonly label: string;
}

export function SelectField({ label, hint, error, isLabelHidden, className, id, options, ...selectProps }: SharedFieldProps & SelectHTMLAttributes<HTMLSelectElement> & { readonly options: readonly SelectOption[] }) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  return (
    <FieldFrame label={label} hint={hint} error={error} isLabelHidden={isLabelHidden} fieldId={fieldId} className={className}>
      <select id={fieldId} className={`${styles.input} ${styles.select}`} aria-invalid={error ? true : undefined} aria-describedby={describedBy(fieldId, hint, error)} {...selectProps}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldFrame>
  );
}

export function CheckboxField({ label, description, className, ...inputProps }: { readonly label: ReactNode; readonly description?: ReactNode; readonly className?: string } & Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return (
    <label className={className ? `${styles.checkbox} ${className}` : styles.checkbox}>
      <input type="checkbox" className={styles.checkboxInput} {...inputProps} />
      <span>
        <span className={styles.checkboxLabel}>{label}</span>
        {description ? <span className={styles.checkboxDescription}>{description}</span> : null}
      </span>
    </label>
  );
}

export function readIssueMessageForField(issues: readonly { path: string; message: string }[], fieldPath: string): string | null {
  return issues.find((issue) => issue.path === fieldPath)?.message ?? null;
}
