import type { FieldCipher } from "../../../utils/crypto.util.js";
import type { IdentityDocumentType, VerificationDetails } from "../models/verifications.model.js";

export interface VerificationDetailsInput {
  readonly legalName?: string | undefined;
  readonly businessName?: string | undefined;
  readonly businessAddress?: string | undefined;
  readonly registrationNumber?: string | undefined;
  readonly contactPhone?: string | undefined;
  readonly idType?: IdentityDocumentType | undefined;
  readonly idNumber?: string | undefined;
  readonly documentMediaIds?: readonly string[] | undefined;
}

async function encryptOptionalText(cipher: FieldCipher, value: string | undefined) {
  const trimmed = value?.trim();
  if (trimmed === undefined || trimmed === "") return { encrypted: null, last4: null };
  return { encrypted: await cipher.encryptText(trimmed), last4: trimmed.slice(-4) };
}

export async function encryptVerificationDetails(cipher: FieldCipher, input: VerificationDetailsInput): Promise<VerificationDetails> {
  const registration = await encryptOptionalText(cipher, input.registrationNumber);
  const phone = await encryptOptionalText(cipher, input.contactPhone);
  const identity = await encryptOptionalText(cipher, input.idNumber);
  return {
    legalName: input.legalName?.trim() ?? null,
    businessName: input.businessName?.trim() ?? null,
    businessAddress: input.businessAddress?.trim() ?? null,
    registrationNumberEncrypted: registration.encrypted,
    registrationNumberLast4: registration.last4,
    contactPhoneEncrypted: phone.encrypted,
    contactPhoneLast4: phone.last4,
    idType: input.idType ?? null,
    idNumberEncrypted: identity.encrypted,
    idNumberLast4: identity.last4,
    documentMediaIds: [...(input.documentMediaIds ?? [])],
  };
}

function maskLastFour(last4: string | null): string | null {
  return last4 === null ? null : `******${last4}`;
}

export function maskVerificationDetails(details: VerificationDetails | null) {
  if (details === null) return null;
  return {
    legalName: details.legalName,
    businessName: details.businessName,
    businessAddress: details.businessAddress,
    registrationNumber: maskLastFour(details.registrationNumberLast4),
    contactPhone: maskLastFour(details.contactPhoneLast4),
    idType: details.idType,
    idNumber: maskLastFour(details.idNumberLast4),
    documentMediaIds: details.documentMediaIds,
  };
}
