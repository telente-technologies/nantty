import type { HashedIdentifierType } from "@/types/audience.type";
import { calculateSha256HexOfText } from "@/services/sha256Hashing.service";

export const maximumCustomerListRows = 50_000;

const countryCallingCodes: Record<string, string> = { NG: "234", GH: "233", KE: "254", ZA: "27", GB: "44", US: "1" };

export function normalizeEmailAddressForHashing(rawEmail: string): string | null {
  const email = rawEmail.trim().toLowerCase();
  return /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/.test(email) ? email : null;
}

export function normalizePhoneNumberToE164Digits(rawPhone: string, defaultCountryCode: string): string | null {
  const hasPlus = rawPhone.trim().startsWith("+");
  let digits = rawPhone.replace(/\D/g, "");
  if (!digits) return null;
  if (!hasPlus) {
    const callingCode = countryCallingCodes[defaultCountryCode] ?? "";
    if (digits.startsWith("00")) digits = digits.slice(2);
    else if (digits.startsWith("0")) digits = `${callingCode}${digits.slice(1)}`;
    else if (callingCode && !digits.startsWith(callingCode)) digits = `${callingCode}${digits}`;
  }
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}

export function splitCustomerListTextIntoValues(rawText: string): string[] {
  return rawText
    .split(/[\r\n,;\t]+/)
    .map((value) => value.trim().replace(/^"|"$/g, ""))
    .filter((value) => value.length > 0 && !/^(email|phone|e-mail|mobile)$/i.test(value));
}

export interface HashedCustomerListResult {
  readonly hashedIdentifiers: string[];
  readonly acceptedCount: number;
  readonly rejectedCount: number;
  readonly duplicateCount: number;
}

export async function normalizeAndHashCustomerIdentifiersInBrowser(
  rawValues: readonly string[],
  identifierType: HashedIdentifierType,
  defaultCountryCode: string,
): Promise<HashedCustomerListResult> {
  const normalizedValues = new Set<string>();
  let rejectedCount = 0;
  let duplicateCount = 0;
  for (const rawValue of rawValues.slice(0, maximumCustomerListRows)) {
    const normalized = identifierType === "email" ? normalizeEmailAddressForHashing(rawValue) : normalizePhoneNumberToE164Digits(rawValue, defaultCountryCode);
    if (!normalized) rejectedCount += 1;
    else if (normalizedValues.has(normalized)) duplicateCount += 1;
    else normalizedValues.add(normalized);
  }
  const hashedIdentifiers = await Promise.all(Array.from(normalizedValues, (value) => calculateSha256HexOfText(value)));
  return { hashedIdentifiers, acceptedCount: hashedIdentifiers.length, rejectedCount, duplicateCount };
}
