export type FieldErrors<FieldName extends string = string> = Partial<Record<FieldName, string>>;

export function hasAnyFieldError(errors: FieldErrors): boolean {
  return Object.values(errors).some(Boolean);
}

export function validateRequiredText(value: string, label: string, maximumLength: number, minimumLength = 1): string | undefined {
  const trimmed = value.trim();
  if (trimmed.length < minimumLength) return minimumLength > 1 ? `${label} needs at least ${minimumLength} characters.` : `Enter ${label.toLowerCase()}.`;
  if (trimmed.length > maximumLength) return `${label} can be at most ${maximumLength} characters.`;
  return undefined;
}

const emailPattern = /^[^\s@]{1,64}@[^\s@]{1,190}\.[A-Za-z]{2,24}$/;

export function isValidEmailAddress(candidate: string): boolean {
  return emailPattern.test(candidate.trim());
}

export function isSafeHttpsUrl(candidate: string): boolean {
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" && !url.username && !url.password && url.hostname.includes(".");
  } catch {
    return false;
  }
}

export function createClientIdempotencyKey(prefix = "idem"): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
}
