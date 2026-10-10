import type { Bank, ResolvedBankAccount } from "@/types/commerce.type";

import { api } from "../core/apiClient.service";

export const banksService = {
  listBanksInCountry: (countryCode: string) => api.getList<Bank>("/api/v1/banks", { country: countryCode }),
  resolveBankAccountName: (bankCode: string, accountNumber: string) =>
    api.post<ResolvedBankAccount>("/api/v1/banks/resolve-account", { bankCode, accountNumber }),
};
