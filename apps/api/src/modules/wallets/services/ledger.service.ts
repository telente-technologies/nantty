import { unprocessable } from "../../../errors/domain.error.js";
import type { Clock } from "../../../interfaces/clock.interface.js";
import type { Kobo } from "../../../types/money.type.js";
import type { LedgerAccountSpecification, LedgerPostingResult, LedgerTransactionInput } from "../models/wallets.model.js";
import type { LedgerRepository } from "../repositories/ledger.repository.js";

export const LedgerAccounts = {
  providerClearing: (provider: string): LedgerAccountSpecification => ({
    key: `asset:provider-clearing:${provider}`, ownerType: "platform", ownerId: null, kind: "asset", allowNegative: true,
  }),
  orderEscrow: (orderId: string): LedgerAccountSpecification => ({
    key: `liability:escrow:${orderId}`, ownerType: "order", ownerId: orderId, kind: "liability", allowNegative: false,
  }),
  storeWallet: (storeId: string): LedgerAccountSpecification => ({
    key: `liability:store-wallet:${storeId}`, ownerType: "store", ownerId: storeId, kind: "liability", allowNegative: false,
  }),
  storePayoutPending: (storeId: string): LedgerAccountSpecification => ({
    key: `liability:payout-pending:${storeId}`, ownerType: "store", ownerId: storeId, kind: "liability", allowNegative: false,
  }),
  platformCommission: (): LedgerAccountSpecification => ({
    key: "revenue:commission", ownerType: "platform", ownerId: null, kind: "revenue", allowNegative: false,
  }),
};

export function sumLineAmountsByDirection(input: LedgerTransactionInput, direction: "debit" | "credit"): Kobo {
  return input.lines.filter((line) => line.direction === direction).reduce((total, line) => total + line.amount, 0);
}

export class LedgerService {
  public constructor(public readonly repository: LedgerRepository, private readonly clock: Clock) {}

  public postLedgerTransaction(input: LedgerTransactionInput): Promise<LedgerPostingResult> {
    this.assertTransactionIsBalanced(input);
    return this.repository.postBalancedTransaction(input, this.clock.now());
  }

  public async readAccountBalance(account: LedgerAccountSpecification): Promise<Kobo> {
    return (await this.repository.findAccountByKey(account.key))?.balance ?? 0;
  }

  private assertTransactionIsBalanced(input: LedgerTransactionInput): void {
    if (input.lines.length < 2) throw unprocessable("A ledger transaction needs at least two lines.");
    for (const line of input.lines) {
      if (!Number.isSafeInteger(line.amount) || line.amount <= 0) throw unprocessable("Ledger amounts must be positive whole kobo.");
    }
    if (sumLineAmountsByDirection(input, "debit") !== sumLineAmountsByDirection(input, "credit")) {
      throw unprocessable("Ledger transaction debits and credits must be equal.");
    }
  }
}
