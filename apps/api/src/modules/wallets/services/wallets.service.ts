import { randomUUID } from "node:crypto";

import { providerSupportsCurrency } from "../../../configs/currency.config.js";
import { StoreRole } from "../../../constants/roles.constant.js";
import type { CurrencyCode } from "../../../enums/currency.enum.js";
import { PaymentProvider } from "../../../enums/paymentStatus.enum.js";
import { invalidState, notFound, unprocessable } from "../../../errors/domain.error.js";
import type { AuditRecorder } from "../../../interfaces/audit.interface.js";
import type { Clock } from "../../../interfaces/clock.interface.js";
import type { StoreAccess } from "../../../interfaces/storeAccess.interface.js";
import type { MinorUnits } from "../../../types/money.type.js";
import type { BankDirectory } from "./bankDirectory.service.js";
import { resolveSellerStoreIdForUser } from "../../../utils/sellerStore.util.js";
import type { Page, PageRequest } from "../../../types/pagination.type.js";
import type { FieldCipher } from "../../../utils/crypto.util.js";
import { Money, type MoneyDto } from "../../../utils/money.util.js";
import type { PaymentGateway } from "../../payments/gateways/paymentGateway.interface.js";
import type { LedgerEntryRecord, PayoutAccountRecord, WithdrawalRecord } from "../models/wallets.model.js";
import type { PayoutAccountsRepository, WithdrawalsRepository } from "../repositories/wallets.repository.js";
import { LedgerAccounts, type LedgerService } from "./ledger.service.js";

export const PAYOUT_PROVIDER = PaymentProvider.PAYSTACK;

const COUNTRY_CODE_FOR_PAYOUT_CURRENCY: Partial<Record<CurrencyCode, string>> = { NGN: "NG", GHS: "GH", KES: "KE", ZAR: "ZA" };

export interface WalletsDependencies {
  readonly ledger: LedgerService;
  readonly payoutAccounts: PayoutAccountsRepository;
  readonly withdrawals: WithdrawalsRepository;
  readonly storeAccess: StoreAccess;
  readonly cipher: FieldCipher;
  readonly audit: AuditRecorder;
  readonly clock: Clock;
  readonly paymentGateways: Readonly<Record<string, PaymentGateway>>;
  readonly bankDirectory: BankDirectory;
  readonly sumEscrowHeldForStore: (storeId: string) => Promise<MinorUnits>;
}

export interface StoreWalletSummary {
  readonly storeId: string;
  readonly currency: CurrencyCode;
  readonly availableBalance: MoneyDto;
  readonly pendingWithdrawals: MoneyDto;
  readonly heldInEscrow: MoneyDto;
}

export interface NewPayoutAccountInput {
  readonly bankCode: string;
  readonly bankName?: string | undefined;
  readonly accountNumber: string;
  readonly accountName: string;
  readonly isDefault?: boolean;
}

const VIEWER_ROLES = [StoreRole.OWNER, StoreRole.MANAGER];
const OWNER_ONLY = [StoreRole.OWNER];

export class WalletsService {
  public constructor(public readonly dependencies: WalletsDependencies) {}

  public async getStoreWallet(userId: string, requestedStoreId: string | undefined): Promise<StoreWalletSummary> {
    const { storeAccess, ledger, sumEscrowHeldForStore } = this.dependencies;
    const storeId = await resolveSellerStoreIdForUser(storeAccess, userId, requestedStoreId, VIEWER_ROLES);
    const currency = await this.findStoreCurrency(storeId);
    return {
      storeId,
      currency,
      availableBalance: Money.of(await ledger.readAccountBalance(LedgerAccounts.storeWallet(storeId, currency)), currency).toDto(),
      pendingWithdrawals: Money.of(await ledger.readAccountBalance(LedgerAccounts.storePayoutPending(storeId, currency)), currency).toDto(),
      heldInEscrow: Money.of(await sumEscrowHeldForStore(storeId), currency).toDto(),
    };
  }

  public async listStoreWalletTransactions(userId: string, requestedStoreId: string | undefined, page: PageRequest): Promise<Page<LedgerEntryRecord>> {
    const storeId = await resolveSellerStoreIdForUser(this.dependencies.storeAccess, userId, requestedStoreId, VIEWER_ROLES);
    const currency = await this.findStoreCurrency(storeId);
    return this.dependencies.ledger.repository.listEntriesForAccount(LedgerAccounts.storeWallet(storeId, currency).key, page);
  }

  public async listPayoutAccounts(userId: string, requestedStoreId: string | undefined): Promise<readonly PayoutAccountRecord[]> {
    const storeId = await resolveSellerStoreIdForUser(this.dependencies.storeAccess, userId, requestedStoreId, VIEWER_ROLES);
    return this.dependencies.payoutAccounts.listForStore(storeId);
  }

  public async addPayoutAccount(userId: string, requestedStoreId: string | undefined, input: NewPayoutAccountInput): Promise<PayoutAccountRecord> {
    const { storeAccess, payoutAccounts, cipher, audit } = this.dependencies;
    const storeId = await resolveSellerStoreIdForUser(storeAccess, userId, requestedStoreId, OWNER_ONLY);
    if (!/^\d{10}$/.test(input.accountNumber)) throw unprocessable("Account numbers must be 10 digits.");
    const bankName = await this.findBankNameForStoreCurrency(storeId, input.bankCode, input.bankName);
    const existing = await payoutAccounts.listForStore(storeId);
    const account = await payoutAccounts.create({
      storeId,
      bankCode: input.bankCode,
      bankName,
      accountNumberEncrypted: await cipher.encryptText(input.accountNumber),
      accountLast4: input.accountNumber.slice(-4),
      accountName: input.accountName,
      isDefault: input.isDefault ?? existing.length === 0,
    });
    await audit.record({ actorId: userId, action: "wallets.payout_account_added", entityType: "store", entityId: storeId, metadata: { payoutAccountId: account.id } });
    return account;
  }

  public async removePayoutAccount(userId: string, requestedStoreId: string | undefined, payoutAccountId: string): Promise<void> {
    const storeId = await resolveSellerStoreIdForUser(this.dependencies.storeAccess, userId, requestedStoreId, OWNER_ONLY);
    if (!(await this.dependencies.payoutAccounts.delete(storeId, payoutAccountId))) throw notFound("Payout account");
    await this.dependencies.audit.record({ actorId: userId, action: "wallets.payout_account_removed", entityType: "store", entityId: storeId, metadata: { payoutAccountId } });
  }

  public async listWithdrawals(userId: string, requestedStoreId: string | undefined, page: PageRequest): Promise<Page<WithdrawalRecord>> {
    const storeId = await resolveSellerStoreIdForUser(this.dependencies.storeAccess, userId, requestedStoreId, VIEWER_ROLES);
    return this.dependencies.withdrawals.listForStore(storeId, page);
  }

  public async requestWithdrawal(userId: string, requestedStoreId: string | undefined, amount: MinorUnits, payoutAccountId: string): Promise<WithdrawalRecord> {
    const { storeAccess, payoutAccounts, withdrawals, ledger, audit, clock } = this.dependencies;
    const storeId = await resolveSellerStoreIdForUser(storeAccess, userId, requestedStoreId, OWNER_ONLY);
    const currency = await this.findStoreCurrency(storeId);
    if (!providerSupportsCurrency(PAYOUT_PROVIDER, currency)) throw unprocessable(`Payouts in ${currency} are not supported yet.`);
    if ((await payoutAccounts.findForStore(storeId, payoutAccountId)) === undefined) throw notFound("Payout account");
    const withdrawal = await withdrawals.create({ storeId, payoutAccountId, amount, currency, reference: `withdrawal-${randomUUID()}`, requestedById: userId });
    try {
      await ledger.postLedgerTransaction({
        reference: withdrawal.reference,
        kind: "withdrawal_requested",
        description: `Withdrawal requested for store ${storeId}`,
        lines: [
          { account: LedgerAccounts.storeWallet(storeId, currency), direction: "debit", amount, currency },
          { account: LedgerAccounts.storePayoutPending(storeId, currency), direction: "credit", amount, currency },
        ],
      });
    } catch (error) {
      await withdrawals.changeStatus(withdrawal.id, "pending", "failed", clock.now(), "insufficient_funds");
      throw error;
    }
    await audit.record({ actorId: userId, action: "wallets.withdrawal_requested", entityType: "withdrawal", entityId: withdrawal.id, metadata: { storeId, amount } });
    return withdrawal;
  }

  public async processWithdrawal(adminId: string, withdrawalId: string): Promise<WithdrawalRecord> {
    const { withdrawals, payoutAccounts, cipher, paymentGateways, audit } = this.dependencies;
    const withdrawal = await withdrawals.findById(withdrawalId);
    if (withdrawal === undefined) throw notFound("Withdrawal");
    if (withdrawal.status !== "pending" && withdrawal.status !== "processing") throw invalidState("This withdrawal has already been processed.");
    const payoutAccount = await payoutAccounts.findForStore(withdrawal.storeId, withdrawal.payoutAccountId);
    const gateway = paymentGateways[PAYOUT_PROVIDER];
    if (payoutAccount === undefined || gateway === undefined) return this.failWithdrawal(adminId, withdrawal, "payout_account_unavailable");
    const result = await gateway.transferToBank({
      reference: withdrawal.reference,
      amount: withdrawal.amount,
      currency: withdrawal.currency,
      bankCode: payoutAccount.bankCode,
      accountNumber: await cipher.decryptText(payoutAccount.accountNumberEncrypted),
      accountName: payoutAccount.accountName,
      recipientCode: payoutAccount.recipientCode,
      reason: "Zudomart seller payout",
    });
    if (result.recipientCode !== null && result.recipientCode !== payoutAccount.recipientCode) {
      await payoutAccounts.saveRecipientCode(payoutAccount.id, result.recipientCode);
    }
    if (result.status === "failed") return this.failWithdrawal(adminId, withdrawal, result.failureReason ?? "transfer_failed");
    if (result.status === "pending") {
      await withdrawals.changeStatus(withdrawal.id, "pending", "processing", this.dependencies.clock.now(), null);
    } else {
      await this.completeWithdrawal(withdrawal);
    }
    await audit.record({ actorId: adminId, action: `wallets.withdrawal_${result.status}`, entityType: "withdrawal", entityId: withdrawal.id, metadata: { amount: withdrawal.amount } });
    return (await withdrawals.findById(withdrawal.id)) ?? withdrawal;
  }

  private async findBankNameForStoreCurrency(storeId: string, bankCode: string, suppliedBankName: string | undefined): Promise<string> {
    const countryCode = COUNTRY_CODE_FOR_PAYOUT_CURRENCY[await this.findStoreCurrency(storeId)];
    const banks = countryCode === undefined ? [] : await this.dependencies.bankDirectory.listBanksForCountry(countryCode);
    const bank = banks.find((candidate) => candidate.code === bankCode);
    if (banks.length > 0 && bank === undefined) throw unprocessable("Choose a bank from the list.");
    const bankName = bank?.name ?? suppliedBankName;
    if (bankName === undefined) throw unprocessable("Choose a bank from the list.");
    return bankName;
  }

  private async findStoreCurrency(storeId: string): Promise<CurrencyCode> {
    const [store] = await this.dependencies.storeAccess.findStoreSummaries([storeId]);
    if (store === undefined) throw notFound("Store");
    return store.currency;
  }

  private async completeWithdrawal(withdrawal: WithdrawalRecord): Promise<void> {
    const { withdrawals, ledger, clock } = this.dependencies;
    const claimed =
      (await withdrawals.changeStatus(withdrawal.id, "pending", "paid", clock.now(), null)) ||
      (await withdrawals.changeStatus(withdrawal.id, "processing", "paid", clock.now(), null));
    if (!claimed) throw invalidState("This withdrawal has already been processed.");
    await ledger.postLedgerTransaction({
      reference: `${withdrawal.reference}:paid`,
      kind: "withdrawal_paid",
      description: `Withdrawal ${withdrawal.id} paid out`,
      lines: [
        { account: LedgerAccounts.storePayoutPending(withdrawal.storeId, withdrawal.currency), direction: "debit", amount: withdrawal.amount, currency: withdrawal.currency },
        { account: LedgerAccounts.providerClearing(PAYOUT_PROVIDER, withdrawal.currency), direction: "credit", amount: withdrawal.amount, currency: withdrawal.currency },
      ],
    });
  }

  private async failWithdrawal(adminId: string, withdrawal: WithdrawalRecord, reason: string): Promise<WithdrawalRecord> {
    const { withdrawals, ledger, clock, audit } = this.dependencies;
    const claimed =
      (await withdrawals.changeStatus(withdrawal.id, "pending", "failed", clock.now(), reason)) ||
      (await withdrawals.changeStatus(withdrawal.id, "processing", "failed", clock.now(), reason));
    if (!claimed) throw invalidState("This withdrawal has already been processed.");
    await ledger.postLedgerTransaction({
      reference: `${withdrawal.reference}:reversed`,
      kind: "withdrawal_reversed",
      description: `Withdrawal ${withdrawal.id} failed and was returned to the wallet`,
      lines: [
        { account: LedgerAccounts.storePayoutPending(withdrawal.storeId, withdrawal.currency), direction: "debit", amount: withdrawal.amount, currency: withdrawal.currency },
        { account: LedgerAccounts.storeWallet(withdrawal.storeId, withdrawal.currency), direction: "credit", amount: withdrawal.amount, currency: withdrawal.currency },
      ],
    });
    await audit.record({ actorId: adminId, action: "wallets.withdrawal_failed", entityType: "withdrawal", entityId: withdrawal.id, metadata: { reason } });
    return (await withdrawals.findById(withdrawal.id)) ?? withdrawal;
  }
}

