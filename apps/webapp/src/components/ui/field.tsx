import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

import styles from "./field.module.css";

interface FieldShellProps {
  readonly label: string;
  readonly hint?: ReactNode;
  readonly error?: string | null;
  readonly hideLabel?: boolean;
  readonly children: (id: string, describedBy: string | undefined) => ReactNode;
  readonly className?: string;
}

function FieldShell({ label, hint, error, hideLabel = false, children, className }: FieldShellProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = error ? errorId : hint ? hintId : undefined;

  return (
    <div className={[styles.field, className ?? ""].filter(Boolean).join(" ")}>
      <label className={hideLabel ? "visuallyHidden" : styles.label} htmlFor={id}>
        {label}
      </label>
      {children(id, describedBy)}
      {hint && !error ? (
        <p className={styles.hint} id={hintId}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className={styles.error} id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
  readonly label: string;
  readonly hint?: ReactNode;
  readonly error?: string | null;
  readonly hideLabel?: boolean;
  readonly className?: string;
};

export function TextField({ label, hint, error, hideLabel, className, ...rest }: TextFieldProps) {
  return (
    <FieldShell label={label} hint={hint} error={error} hideLabel={hideLabel} className={className}>
      {(id, describedBy) => (
        <input id={id} className={styles.input} aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...rest} />
      )}
    </FieldShell>
  );
}

type TextAreaFieldProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> & {
  readonly label: string;
  readonly hint?: ReactNode;
  readonly error?: string | null;
  readonly className?: string;
};

export function TextAreaField({ label, hint, error, className, ...rest }: TextAreaFieldProps) {
  return (
    <FieldShell label={label} hint={hint} error={error} className={className}>
      {(id, describedBy) => (
        <textarea id={id} className={[styles.input, styles.textarea].join(" ")} aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...rest} />
      )}
    </FieldShell>
  );
}

type SelectFieldProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> & {
  readonly label: string;
  readonly hint?: ReactNode;
  readonly error?: string | null;
  readonly className?: string;
  readonly children: ReactNode;
};

export function SelectField({ label, hint, error, className, children, ...rest }: SelectFieldProps) {
  return (
    <FieldShell label={label} hint={hint} error={error} className={className}>
      {(id, describedBy) => (
        <select id={id} className={styles.input} aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...rest}>
          {children}
        </select>
      )}
    </FieldShell>
  );
}
