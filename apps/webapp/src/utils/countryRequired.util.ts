export const countryRequiredCode = "COUNTRY_REQUIRED";

export const countryChoices = [
  { code: "NG", label: "Nigeria" },
  { code: "GH", label: "Ghana" },
  { code: "KE", label: "Kenya" },
  { code: "ZA", label: "South Africa" },
  { code: "other", label: "Somewhere else" },
] as const;

export function isCountryRequiredCode(code: unknown): boolean {
  return code === countryRequiredCode;
}

export function resolveCountryChoice(choice: string, otherCode: string): string | null {
  const countryCode = choice === "other" ? otherCode.trim().toUpperCase() : choice;
  return /^[A-Z]{2}$/.test(countryCode) ? countryCode : null;
}

export interface CountryRequiredRetry {
  readonly handle: (code: unknown, retry: () => void) => boolean;
  readonly saved: () => void;
  readonly dismissed: () => void;
}

export function createCountryRequiredRetry(onOpenChange: (isOpen: boolean) => void): CountryRequiredRetry {
  let pendingRetry: (() => void) | null = null;
  return {
    handle(code, retry) {
      if (!isCountryRequiredCode(code)) return false;
      pendingRetry = retry;
      onOpenChange(true);
      return true;
    },
    saved() {
      const retry = pendingRetry;
      pendingRetry = null;
      onOpenChange(false);
      retry?.();
    },
    dismissed() {
      pendingRetry = null;
      onOpenChange(false);
    },
  };
}
