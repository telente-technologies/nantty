import { randomUUID } from "node:crypto";

import { providerSupportsCurrency } from "../../../configs/currency.config.js";
import { PaymentProvider } from "../../../enums/paymentStatus.enum.js";
import { invalidState, notFound, unprocessable } from "../../../errors/domain.error.js";
import type { AuditRecorder } from "../../../interfaces/audit.interface.js";
import type { Clock } from "../../../interfaces/clock.interface.js";
import type { Principal } from "../../../interfaces/principal.interface.js";
import type { MinorUnits } from "../../../types/money.type.js";
import type { Page, PageRequest } from "../../../types/pagination.type.js";
import type { FieldCipher } from "../../../utils/crypto.util.js";
import type { PaymentGateway } from "../../payments/gateways/paymentGateway.interface.js";
import { describeWalletOwner, findWalletOwnerOfRecord, type WalletScopeInput, type WithdrawalRecord } from "../models/wallets.model.js";
import type { PayoutAccountsRepository, WithdrawalsRepository } from "../repositories/wallets.repository.js";
import { findPayoutPendingAccountForOwner, findWalletAccountForOwner, LedgerAccounts, type LedgerService } from "./ledger.service.js";
import { WALLET_OWNER_ROLES, WALLET_VIEWER_ROLES, type WalletOwnerResolver } from "./walletOwnerResolver.service.js";

export const PAYOUT_PROVIDER = PaymentProvider.PAYSTACK;

export interface WithdrawalsDependencies {
  readonly ledger: LedgerService;
  readonly payoutAccounts: PayoutAccountsRepository;
  readonly withdrawals: WithdrawalsRepository;
  readonly owners: WalletOwnerResolver;
  readonly cipher: FieldCipher;
  readonly audit: AuditRecorder;
  readonly clock: Clock;
  readonly paymentGateways: Readonly<Record<string, PaymentGateway>>;
}

export class WithdrawalsService {
  public constructor(private readonly dependencies: WithdrawalsDependencies) {}

  public async listWithdrawals(principal: Principal, scope: WalletScopeInput, page: PageRequest): Promise<Page<WithdrawalRecord>> {
    const { owner } = await this.dependencies.owners.resolveWallet(principal, scope, WALLET_VIEWER_ROLES);
    return this.dependencies.withdrawals.listForOwner(owner, page);
  }

  public async requestWithdrawal(principal: Principal, scope: WalletScopeInput, amount: MinorUnits, payoutAccountId: string): Promise<WithdrawalRecord> {
    const { payoutAccounts, withdrawals, ledger, audit, clock, owners } = this.dependencies;
    const { owner, currency } = await owners.resolveWallet(principal, scope, WALLET_OWNER_ROLES);
    if (!providerSupportsCurrency(PAYOUT_PROVIDER, currency)) throw unprocessable(`Payouts in ${currency} are not supported yet.`);
    if ((await payoutAccounts.findForOwner(owner, payoutAccountId)) === undefined) throw notFound("Payout account");
    const withdrawal = await withdrawals.create({
      ...describeWalletOwner(owner), payoutAccountId, amount, currency, reference: `withdrawal-${randomUUID()}`, requestedById: principal.userId,
    });
    try {
      await ledger.postLedgerTransaction({
        reference: withdrawal.reference,
        kind: "withdrawal_requested",
        description: `Withdrawal requested from a ${owner.kind} wallet`,
        lines: [
          { account: findWalletAccountForOwner(owner, currency), direction: "debit", amount, currency },
          { account: findPayoutPendingAccountForOwner(owner, currency), direction: "credit", amount, currency },
        ],
      });
    } catch (error) {
      await withdrawals.changeStatus(withdrawal.id, "pending", "failed", clock.now(), "insufficient_funds");
      throw error;
    }
    await audit.record({ actorId: principal.userId, action: "wallets.withdrawal_requested", entityType: "withdrawal", entityId: withdrawal.id, metadata: { ...describeWalletOwner(owner), amount, currency } });
    return withdrawal;
  }

  public async processWithdrawal(adminId: string, withdrawalId: string): Promise<WithdrawalRecord> {
    const { withdrawals, payoutAccounts, cipher, paymentGateways, audit } = this.dependencies;
    const withdrawal = await withdrawals.findById(withdrawalId);
    if (withdrawal === undefined) throw notFound("Withdrawal");
    if (withdrawal.status !== "pending" && withdrawal.status !== "processing") throw invalidState("This withdrawal has already been processed.");
    const payoutAccount = await payoutAccounts.findForOwner(findWalletOwnerOfRecord(withdrawal), withdrawal.payoutAccountId);
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
      reason: "Zudomart payout",
    });
    if (result.recipientCode !== null && result.recipientCode !== payoutAccount.recipientCode) await payoutAccounts.saveRecipientCode(payoutAccount.id, result.recipientCode);
    if (result.status === "failed") return this.failWithdrawal(adminId, withdrawal, result.failureReason ?? "transfer_failed");
    if (result.status === "pending") {
      await withdrawals.changeStatus(withdrawal.id, "pending", "processing", this.dependencies.clock.now(), null);
    } else {
      await this.completeWithdrawal(withdrawal);
    }
    await audit.record({ actorId: adminId, action: `wallets.withdrawal_${result.status}`, entityType: "withdrawal", entityId: withdrawal.id, metadata: { amount: withdrawal.amount } });
    return (await withdrawals.findById(withdrawal.id)) ?? withdrawal;
  }

  private async completeWithdrawal(withdrawal: WithdrawalRecord): Promise<void> {
    const { withdrawals, ledger, clock } = this.dependencies;
    const claimed =
      (await withdrawals.changeStatus(withdrawal.id, "pending", "paid", clock.now(), null)) ||
      (await withdrawals.changeStatus(withdrawal.id, "processing", "paid", clock.now(), null));
    if (!claimed) throw invalidState("This withdrawal has already been processed.");
    const owner = findWalletOwnerOfRecord(withdrawal);
    await ledger.postLedgerTransaction({
      reference: `${withdrawal.reference}:paid`,
      kind: "withdrawal_paid",
      description: `Withdrawal ${withdrawal.id} paid out`,
      lines: [
        { account: findPayoutPendingAccountForOwner(owner, withdrawal.currency), direction: "debit", amount: withdrawal.amount, currency: withdrawal.currency },
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
    const owner = findWalletOwnerOfRecord(withdrawal);
    await ledger.postLedgerTransaction({
      reference: `${withdrawal.reference}:reversed`,
      kind: "withdrawal_reversed",
      description: `Withdrawal ${withdrawal.id} failed and was returned to the wallet`,
      lines: [
        { account: findPayoutPendingAccountForOwner(owner, withdrawal.currency), direction: "debit", amount: withdrawal.amount, currency: withdrawal.currency },
        { account: findWalletAccountForOwner(owner, withdrawal.currency), direction: "credit", amount: withdrawal.amount, currency: withdrawal.currency },
      ],
    });
    await audit.record({ actorId: adminId, action: "wallets.withdrawal_failed", entityType: "withdrawal", entityId: withdrawal.id, metadata: { reason } });
    return (await withdrawals.findById(withdrawal.id)) ?? withdrawal;
  }
}
