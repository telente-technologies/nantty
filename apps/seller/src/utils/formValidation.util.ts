export type FieldCheck = (value: unknown) => string | null;

export interface ValidationIssue {
  readonly path: string;
  readonly message: string;
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const phonePattern = /^\+?[0-9][0-9\s-]{6,18}$/;

export const fieldChecks = {
  text(options: { readonly label: string; readonly min?: number; readonly max: number }): FieldCheck {
    return (value) => {
      if (typeof value !== "string") return `${options.label} is required.`;
      const trimmedLength = value.trim().length;
      if (trimmedLength < (options.min ?? 1)) return options.min && options.min > 1 ? `${options.label} needs at least ${options.min} characters.` : `${options.label} is required.`;
      if (trimmedLength > options.max) return `${options.label} must be ${options.max} characters or fewer.`;
      return null;
    };
  },
  email(label = "Email"): FieldCheck {
    return (value) => (typeof value === "string" && emailPattern.test(value.trim()) && value.length <= 254 ? null : `Enter a valid ${label.toLowerCase()}.`);
  },
  phone(label = "Phone number"): FieldCheck {
    return (value) => (typeof value === "string" && phonePattern.test(value.trim()) ? null : `Enter a valid ${label.toLowerCase()}, for example +234 803 555 0142.`);
  },
  integer(options: { readonly label: string; readonly min?: number; readonly max?: number }): FieldCheck {
    return (value) => {
      if (typeof value !== "number" || !Number.isSafeInteger(value)) return `${options.label} must be a whole number.`;
      if (options.min !== undefined && value < options.min) return `${options.label} must be at least ${options.min}.`;
      if (options.max !== undefined && value > options.max) return `${options.label} must be at most ${options.max}.`;
      return null;
    };
  },
  oneOf<Allowed extends string>(label: string, allowedValues: readonly Allowed[]): FieldCheck {
    return (value) => (typeof value === "string" && (allowedValues as readonly string[]).includes(value) ? null : `Choose a valid ${label.toLowerCase()}.`);
  },
  boolean(label: string): FieldCheck {
    return (value) => (typeof value === "boolean" ? null : `${label} must be on or off.`);
  },
  pattern(label: string, pattern: RegExp, hint: string): FieldCheck {
    return (value) => (typeof value === "string" && pattern.test(value) ? null : `${label} ${hint}`);
  },
  optional(check: FieldCheck): FieldCheck {
    return (value) => (value === undefined || value === null || value === "" ? null : check(value));
  },
};

export function validateObjectAgainstChecks(input: unknown, checks: Record<string, FieldCheck>): ValidationIssue[] {
  const record = typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
  return Object.entries(checks).flatMap(([path, check]) => {
    const message = check(record[path]);
    return message ? [{ path, message }] : [];
  });
}

export function convertIssuesToFieldErrorMap(issues: readonly ValidationIssue[]): Record<string, string> {
  return Object.fromEntries(issues.map((issue) => [issue.path, issue.message]));
}
