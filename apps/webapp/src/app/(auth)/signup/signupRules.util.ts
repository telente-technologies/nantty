export type SignUpStep = "contact" | "verify" | "birthday" | "password" | "username" | "topics";

export const STEP_ORDER: readonly SignUpStep[] = ["contact", "verify", "birthday", "password", "username", "topics"];

export const USERNAME_UNAVAILABLE_MESSAGES: Record<string, string> = {
  taken: "That username is taken",
  reserved: "That username is reserved for Zudomart and can't be used.",
  invalid: "Use 3–20 letters, numbers, underscores or full stops.",
  recently_used: "That username was used recently and isn't available yet.",
  withheld: "That username has been withheld under our policies.",
};

export const DEFAULT_USERNAME_HINT = "3–20 characters. Letters, numbers, underscores and full stops only.";
export const MINIMUM_TOPICS_TO_CONTINUE = 3;
export const MINIMUM_CUSTOMISING_SCREEN_DURATION_MS = 1500;
export const RESEND_SECONDS = 60;

export function isValidEmailAddress(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

export function removeNonDigitCharacters(value: string): string {
  return value.replace(/\D/g, "");
}

export function insertSlashesIntoBirthdayInput(value: string): string {
  const digits = removeNonDigitCharacters(value).slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join("/");
}

export function parseBirthdayFromDayMonthYear(value: string): Date | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return null;
  const [day, month, year] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  const isRealCalendarDate = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return isRealCalendarDate ? date : null;
}

export function calculateAgeInYears(birthday: Date, today = new Date()): number {
  let age = today.getUTCFullYear() - birthday.getUTCFullYear();
  const birthdayNotYetReachedThisYear =
    today.getUTCMonth() < birthday.getUTCMonth() || (today.getUTCMonth() === birthday.getUTCMonth() && today.getUTCDate() < birthday.getUTCDate());
  if (birthdayNotYetReachedThisYear) age -= 1;
  return age;
}

export const MINIMUM_ACCOUNT_AGE_IN_YEARS = 13;

export function isBirthdayValidForNewAccount(value: string): boolean {
  const birthday = parseBirthdayFromDayMonthYear(value);
  if (!birthday) return false;
  const age = calculateAgeInYears(birthday);
  return age >= MINIMUM_ACCOUNT_AGE_IN_YEARS && age <= 120;
}

export function checkPasswordRequirements(password: string) {
  return {
    hasLengthBetweenEightAndTwenty: password.length >= 8 && password.length <= 20,
    hasLetterAndNumber: /[A-Za-z]/.test(password) && /\d/.test(password),
    hasSpecialCharacter: /[^A-Za-z0-9\s]/.test(password),
  };
}

export function calculatePasswordStrength(password: string): "none" | "weak" | "medium" | "strong" {
  if (!password) return "none";
  const met = Object.values(checkPasswordRequirements(password)).filter(Boolean).length;
  if (met === 3) return "strong";
  if (met === 2) return "medium";
  return "weak";
}

export function isPasswordStrongEnoughForAccount(password: string): boolean {
  return Object.values(checkPasswordRequirements(password)).filter(Boolean).length === 3;
}

export function isValidUsername(value: string): boolean {
  return /^[A-Za-z0-9_.]{3,20}$/.test(value);
}

export interface SignUpHeading {
  readonly title: string;
  readonly subtitle: string;
}

export function describeSignUpStepHeading(step: SignUpStep, destination: string, isCustomisingFeed: boolean): SignUpHeading {
  if (step === "contact") return { title: "What’s your email?", subtitle: "We’ll send you a 6-digit code to confirm it’s you." };
  if (step === "verify") return { title: "Enter 6-digit code", subtitle: `Your code was sent to ${destination}` };
  if (step === "birthday") return { title: "When’s your birthday?", subtitle: "Your birthday won’t be shown publicly." };
  if (step === "password") return { title: "Create password", subtitle: "Choose a strong password to protect your account." };
  if (step === "username") {
    return {
      title: "Create username",
      subtitle: "We've suggested one for you. Keep it, change it, or skip — you'll keep the suggested username and can change it later in Settings.",
    };
  }
  return { title: "Personalize your feed", subtitle: isCustomisingFeed ? "Customizing your feed..." : "Add or edit topics you follow. Chose three or more." };
}
