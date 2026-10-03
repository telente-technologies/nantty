import { ApiError } from "@/errors/api.error";
import type { Bank } from "@/types/commerce.type";

import { getSignedInMockUser } from "./fixtures.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";

const bank = (code: string, name: string, countryCode: string): Bank => ({ code, name, countryCode });

const SUPPORTED_BANKS: readonly Bank[] = [
  bank("044", "Access Bank", "NG"),
  bank("023", "Citibank Nigeria", "NG"),
  bank("050", "Ecobank Nigeria", "NG"),
  bank("070", "Fidelity Bank", "NG"),
  bank("011", "First Bank of Nigeria", "NG"),
  bank("214", "First City Monument Bank", "NG"),
  bank("058", "Guaranty Trust Bank", "NG"),
  bank("030", "Heritage Bank", "NG"),
  bank("082", "Keystone Bank", "NG"),
  bank("50515", "Moniepoint MFB", "NG"),
  bank("999992", "OPay", "NG"),
  bank("999991", "PalmPay", "NG"),
  bank("076", "Polaris Bank", "NG"),
  bank("221", "Stanbic IBTC Bank", "NG"),
  bank("232", "Sterling Bank", "NG"),
  bank("032", "Union Bank of Nigeria", "NG"),
  bank("033", "United Bank for Africa", "NG"),
  bank("035", "Wema Bank", "NG"),
  bank("057", "Zenith Bank", "NG"),
  bank("GH-GCB", "GCB Bank", "GH"),
  bank("GH-ECO", "Ecobank Ghana", "GH"),
  bank("GH-MTN", "MTN Mobile Money", "GH"),
  bank("KE-KCB", "KCB Bank", "KE"),
  bank("KE-EQT", "Equity Bank", "KE"),
  bank("KE-MPS", "M-Pesa", "KE"),
];

export const bankNameForCode = (code: string) => SUPPORTED_BANKS.find((candidate) => candidate.code === code)?.name ?? "Bank";

export const banksMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/banks", ({ query }) => {
    const countryCode = (query.get("country") ?? "NG").toUpperCase();
    return SUPPORTED_BANKS.filter((candidate) => candidate.countryCode === countryCode);
  }),
  createMockRoute("POST", "/api/v1/banks/resolve-account", ({ body }) => {
    const { bankCode, accountNumber } = body as { bankCode: string; accountNumber: string };
    if (!SUPPORTED_BANKS.some((candidate) => candidate.code === bankCode)) throw new ApiError(422, "Choose your bank");
    if (!/^\d{10}$/.test(accountNumber)) throw new ApiError(422, "Account numbers have 10 digits");
    if (accountNumber.startsWith("000")) throw new ApiError(404, "We couldn't find that account. Check the number and bank.", "ACCOUNT_NOT_FOUND");
    if (accountNumber.startsWith("111")) return { accountName: "CHUKWUEMEKA OBI" };
    return { accountName: getSignedInMockUser().name.toUpperCase() };
  }),
];
