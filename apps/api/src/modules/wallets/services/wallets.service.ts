import { isSupportedCurrencyCode, type CurrencyCode } from "../../../enums/currency.enum.js";
import { notFound, unprocessable } from "../../../errors/domain.error.js";
import type { AuditRecorder } from "../../../interfaces/audit.interface.js";
import type { Principal } from "../../../interfaces/principal.interface.js";
import type { MinorUnits } from "../../../types/money.type.js";
import type { Page, PageRequest } from "../../../types/pagination.type.js";
import type { FieldCipher } from "../../../utils/crypto.util.js";
import { Money, type MoneyDto } from "../../../utils/money.util.js";
import { describeWalletOwner, type LedgerEntryRecord, type PayoutAccountRecord, type WalletOwner, type WalletScopeInput } from "../models/wallets.model.js";
import type { PayoutAccountsRepository } from "../repositories/wallets.repository.js";
import { findWalletAccountForOwner, LedgerAccounts, type LedgerService } from "./ledger.service.js";
import { WALLET_OWNER_ROLES, WALLET_VIEWER_ROLES, type WalletOwnerResolver } from "./walletOwnerResolver.service.js";

export interface WalletsDependencies {
  readonly ledger: LedgerService;
  readonly payoutAccounts: PayoutAccountsRepository;
  readonly owners: WalletOwnerResolver;
  readonly cipher: FieldCipher;
  readonly audit: AuditRecorder;
  readonly sumEscrowHeldForStore: (storeId: string) => Promise<MinorUnits>;
}

export interface StoreWalletSummary {
  readonly scope: "store";
  readonly storeId: string;
  readonly currency: CurrencyCode;
  readonly availableBalance: MoneyDto;
  readonly pendingWithdrawals: MoneyDto;
  readonly heldInEscrow: MoneyDto;
}

export interface UserWalletBalance {
  readonly currency: CurrencyCode;
  readonly availableBalance: MoneyDto;
  readonly pendingWithdrawals: MoneyDto;
}

export interface PersonalWalletSummary {
  readonly scope: "user";
  readonly userId: string;
  readonly currency: CurrencyCode;
  readonly balances: readonly UserWalletBalance[];
}

export interface NewPayoutAccountInput {
  readonly bankCode: string;
  readonly bankName?: string | undefined;
  readonly accountNumber: string;
  readonly accountName: string;
  readonly isDefault?: boolean | undefined;
}

export class WalletsService {
  public constructor(public readonly dependencies: WalletsDependencies) {}

  public async getWallet(principal: Principal, scope: WalletScopeInput): Promise<StoreWalletSummary | PersonalWalletSummary> {
    const { owner, currency } = await this.dependencies.owners.resolveWallet(principal, scope, WALLET_VIEWER_ROLES);
    if (owner.kind === "user") return this.buildPersonalWalletSummary(owner.userId, currency);
    const { ledger, sumEscrowHeldForStore } = this.dependencies;
    return {
      scope: "store",
      storeId: owner.storeId,
      currency,
      availableBalance: Money.of(await ledger.readAccountBalance(LedgerAccounts.storeWallet(owner.storeId, currency)), currency).toDto(),
      pendingWithdrawals: Money.of(await ledger.readAccountBalance(LedgerAccounts.storePayoutPending(owner.storeId, currency)), currency).toDto(),
      heldInEscrow: Money.of(await sumEscrowHeldForStore(owner.storeId), currency).toDto(),
    };
  }

  public async buildPersonalWalletSummary(userId: string, preferredCurrency: CurrencyCode): Promise<PersonalWalletSummary> {
    const accounts = await this.dependencies.ledger.repository.listAccountsForOwner("user", userId);
    const currencies = new Set<CurrencyCode>([preferredCurrency, ...accounts.map((account) => account.currency).filter(isSupportedCurrencyCode)]);
    const balanceFor = (key: string) => accounts.find((account) => account.key === key)?.balance ?? 0;
    return {
      scope: "user",
      userId,
      currency: preferredCurrency,
      balances: [...currencies].map((currency) => ({
        currency,
        availableBalance: Money.of(balanceFor(LedgerAccounts.userWallet(userId, currency).key), currency).toDto(),
        pendingWithdrawals: Money.of(balanceFor(LedgerAccounts.userPayoutPending(userId, currency).key), currency).toDto(),
      })),
    };
  }

  public async listWalletTransactions(principal: Principal, scope: WalletScopeInput, page: PageRequest): Promise<Page<LedgerEntryRecord>> {
    const { owner, currency } = await this.dependencies.owners.resolveWallet(principal, scope, WALLET_VIEWER_ROLES);
    return this.dependencies.ledger.repository.listEntriesForAccount(findWalletAccountForOwner(owner, currency).key, page);
  }

  public async listPayoutAccounts(principal: Principal, scope: WalletScopeInput): Promise<readonly PayoutAccountRecord[]> {
    const { owner } = await this.dependencies.owners.resolveWallet(principal, scope, WALLET_VIEWER_ROLES);
    return this.dependencies.payoutAccounts.listForOwner(owner);
  }

  public async addPayoutAccount(principal: Principal, scope: WalletScopeInput, input: NewPayoutAccountInput): Promise<PayoutAccountRecord> {
    const { owner, currency } = await this.dependencies.owners.resolveWallet(principal, scope, WALLET_OWNER_ROLES);
    return this.createPayoutAccountForOwner(principal.userId, owner, currency, input);
  }

  public async createPayoutAccountForOwner(actorId: string, owner: WalletOwner, currency: CurrencyCode, input: NewPayoutAccountInput): Promise<PayoutAccountRecord> {
    const { payoutAccounts, cipher, audit, owners } = this.dependencies;
    if (!/^\d{10}$/.test(input.accountNumber)) throw unprocessable("Account numbers must be 10 digits.");
    const bankName = await owners.findBankNameForCurrency(currency, input.bankCode, input.bankName);
    const existing = await payoutAccounts.listForOwner(owner);
    const account = await payoutAccounts.create({
      ...describeWalletOwner(owner),
      bankCode: input.bankCode,
      bankName,
      accountNumberEncrypted: await cipher.encryptText(input.accountNumber),
      accountLast4: input.accountNumber.slice(-4),
      accountName: input.accountName,
      isDefault: input.isDefault ?? existing.length === 0,
    });
    await audit.record({ actorId, action: "wallets.payout_account_added", entityType: owner.kind, entityId: owner.kind === "store" ? owner.storeId : owner.userId, metadata: { payoutAccountId: account.id } });
    return account;
  }

  public async removePayoutAccount(principal: Principal, scope: WalletScopeInput, payoutAccountId: string): Promise<void> {
    const { owner } = await this.dependencies.owners.resolveWallet(principal, scope, WALLET_OWNER_ROLES);
    if (!(await this.dependencies.payoutAccounts.delete(owner, payoutAccountId))) throw notFound("Payout account");
    const entityId = owner.kind === "store" ? owner.storeId : owner.userId;
    await this.dependencies.audit.record({ actorId: principal.userId, action: "wallets.payout_account_removed", entityType: owner.kind, entityId, metadata: { payoutAccountId } });
  }
}
