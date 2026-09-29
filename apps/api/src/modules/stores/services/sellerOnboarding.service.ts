import type { CurrencyCode } from "../../../enums/currency.enum.js";
import { unprocessable } from "../../../errors/domain.error.js";
import { encryptVerificationDetails } from "../../verifications/services/verificationDetails.service.js";
import type { SellerOnboardingDetails, SellerOnboardingPayoutAccount } from "../models/stores.model.js";
import type { SubmitSellerApplicationBody } from "../validators/stores.validator.js";
import type { StoresService } from "./stores.service.js";

const COUNTRY_CODE_FOR_PAYOUT_CURRENCY: Partial<Record<CurrencyCode, string>> = { NGN: "NG", GHS: "GH", KES: "KE", ZAR: "ZA" };

async function preparePayoutAccount(storesService: StoresService, userId: string, input: NonNullable<SubmitSellerApplicationBody["payoutAccount"]>): Promise<SellerOnboardingPayoutAccount> {
  const { bankDirectory, cipher } = storesService.dependencies;
  const countryCode = COUNTRY_CODE_FOR_PAYOUT_CURRENCY[await storesService.chooseStoreCurrencyForUser(userId)];
  const banks = countryCode === undefined || bankDirectory === undefined ? [] : await bankDirectory.listBanksForCountry(countryCode);
  const bank = banks.find((candidate) => candidate.code === input.bankCode);
  if (bank === undefined) throw unprocessable("Choose a payout bank from the list.");
  return {
    bankCode: bank.code,
    bankName: bank.name,
    accountNumberEncrypted: await cipher.encryptText(input.accountNumber),
    accountLast4: input.accountNumber.slice(-4),
    accountName: input.accountName.trim(),
  };
}

export async function prepareSellerOnboardingDetails(storesService: StoresService, userId: string, input: SubmitSellerApplicationBody): Promise<SellerOnboardingDetails | null> {
  if (input.business === undefined && input.identity === undefined && input.payoutAccount === undefined) return null;
  const verification = input.business === undefined && input.identity === undefined
    ? null
    : await encryptVerificationDetails(storesService.dependencies.cipher, { ...input.business, ...input.identity });
  const payoutAccount = input.payoutAccount === undefined ? null : await preparePayoutAccount(storesService, userId, input.payoutAccount);
  return { verification, payoutAccount };
}
