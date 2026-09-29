import { rolesGrantPermission } from "../../../constants/permissions.constant.js";
import { StoreRole } from "../../../constants/roles.constant.js";
import type { CurrencyCode } from "../../../enums/currency.enum.js";
import { forbidden, notFound, unprocessable } from "../../../errors/domain.error.js";
import type { Principal } from "../../../interfaces/principal.interface.js";
import type { StoreAccess } from "../../../interfaces/storeAccess.interface.js";
import { resolveSellerStoreIdForUser } from "../../../utils/sellerStore.util.js";
import type { WalletOwner, WalletScopeInput } from "../models/wallets.model.js";
import type { BankDirectory } from "./bankDirectory.service.js";

export const WALLET_VIEWER_ROLES = [StoreRole.OWNER, StoreRole.MANAGER];
export const WALLET_OWNER_ROLES = [StoreRole.OWNER];

const COUNTRY_CODE_FOR_PAYOUT_CURRENCY: Partial<Record<CurrencyCode, string>> = { NGN: "NG", GHS: "GH", KES: "KE", ZAR: "ZA" };

export interface ResolvedWallet {
  readonly owner: WalletOwner;
  readonly currency: CurrencyCode;
}

export class WalletOwnerResolver {
  public constructor(private readonly storeAccess: StoreAccess, private readonly bankDirectory: BankDirectory) {}

  public async resolveWallet(principal: Principal, scope: WalletScopeInput, storeRoles: readonly StoreRole[]): Promise<ResolvedWallet> {
    if (scope.scope === "user") return { owner: { kind: "user", userId: principal.userId }, currency: scope.currency };
    if (!rolesGrantPermission(principal.roles, "wallet:manage")) throw forbidden("Only sellers can use a store wallet.");
    const storeId = await resolveSellerStoreIdForUser(this.storeAccess, principal.userId, scope.storeId, storeRoles);
    return { owner: { kind: "store", storeId }, currency: await this.findStoreCurrency(storeId) };
  }

  public async findStoreCurrency(storeId: string): Promise<CurrencyCode> {
    const [store] = await this.storeAccess.findStoreSummaries([storeId]);
    if (store === undefined) throw notFound("Store");
    return store.currency;
  }

  public async findBankNameForCurrency(currency: CurrencyCode, bankCode: string, suppliedBankName: string | undefined): Promise<string> {
    const countryCode = COUNTRY_CODE_FOR_PAYOUT_CURRENCY[currency];
    const banks = countryCode === undefined ? [] : await this.bankDirectory.listBanksForCountry(countryCode);
    const bank = banks.find((candidate) => candidate.code === bankCode);
    if (banks.length > 0 && bank === undefined) throw unprocessable("Choose a bank from the list.");
    const bankName = bank?.name ?? suppliedBankName;
    if (bankName === undefined) throw unprocessable("Choose a bank from the list.");
    return bankName;
  }
}
