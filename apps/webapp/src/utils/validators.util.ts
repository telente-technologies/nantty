export type PasswordStrength = "none" | "weak" | "medium" | "strong";

export interface PasswordRequirementResults {
  readonly hasLengthBetweenEightAndTwenty: boolean;
  readonly hasLetterAndNumber: boolean;
  readonly hasSpecialCharacter: boolean;
}

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
    today.getUTCMonth() < birthday.getUTCMonth() ||
    (today.getUTCMonth() === birthday.getUTCMonth() && today.getUTCDate() < birthday.getUTCDate());
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

export function checkPasswordRequirements(password: string): PasswordRequirementResults {
  return {
    hasLengthBetweenEightAndTwenty: password.length >= 8 && password.length <= 20,
    hasLetterAndNumber: /[A-Za-z]/.test(password) && /\d/.test(password),
    hasSpecialCharacter: /[^A-Za-z0-9\s]/.test(password),
  };
}

export function countPasswordRequirementsMet(password: string): number {
  return Object.values(checkPasswordRequirements(password)).filter(Boolean).length;
}

export function calculatePasswordStrength(password: string): PasswordStrength {
  if (!password) return "none";
  const requirementsMet = countPasswordRequirementsMet(password);
  if (requirementsMet === 3) return "strong";
  if (requirementsMet === 2) return "medium";
  return "weak";
}

export function isPasswordStrongEnoughForAccount(password: string): boolean {
  return countPasswordRequirementsMet(password) === 3;
}

export function isValidUsername(value: string): boolean {
  return /^[A-Za-z0-9_.]{3,20}$/.test(value);
}
