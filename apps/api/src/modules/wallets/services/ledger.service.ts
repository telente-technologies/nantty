import type { CurrencyCode } from "../../../enums/currency.enum.js";
import { unprocessable } from "../../../errors/domain.error.js";
import type { Clock } from "../../../interfaces/clock.interface.js";
import type { MinorUnits } from "../../../types/money.type.js";
import type { Money } from "../../../utils/money.util.js";
import type { LedgerAccountSpecification, LedgerLineInput, LedgerPostingResult, LedgerTransactionInput } from "../models/wallets.model.js";
import type { LedgerRepository } from "../repositories/ledger.repository.js";

export const LedgerAccounts = {
  providerClearing: (provider: string, currency: CurrencyCode): LedgerAccountSpecification => ({
    key: `asset:provider-clearing:${provider}:${currency}`, ownerType: "platform", ownerId: null, kind: "asset", allowNegative: true,
  }),
  foreignExchangePosition: (currency: CurrencyCode): LedgerAccountSpecification => ({
    key: `asset:fx-position:${currency}`, ownerType: "platform", ownerId: null, kind: "asset", allowNegative: true,
  }),
  orderEscrow: (orderId: string): LedgerAccountSpecification => ({
    key: `liability:escrow:${orderId}`, ownerType: "order", ownerId: orderId, kind: "liability", allowNegative: false,
  }),
  storeWallet: (storeId: string, currency: CurrencyCode): LedgerAccountSpecification => ({
    key: `liability:store-wallet:${storeId}:${currency}`, ownerType: "store", ownerId: storeId, kind: "liability", allowNegative: false,
  }),
  storePayoutPending: (storeId: string, currency: CurrencyCode): LedgerAccountSpecification => ({
    key: `liability:payout-pending:${storeId}:${currency}`, ownerType: "store", ownerId: storeId, kind: "liability", allowNegative: false,
  }),
  platformCommission: (currency: CurrencyCode): LedgerAccountSpecification => ({
    key: `revenue:commission:${currency}`, ownerType: "platform", ownerId: null, kind: "revenue", allowNegative: false,
  }),
};

export function sumLineAmountsByCurrencyAndDirection(input: LedgerTransactionInput, direction: "debit" | "credit"): ReadonlyMap<CurrencyCode, MinorUnits> {
  const totals = new Map<CurrencyCode, MinorUnits>();
  for (const line of input.lines) {
    if (line.direction === direction) totals.set(line.currency, (totals.get(line.currency) ?? 0) + line.amount);
  }
  return totals;
}

export class LedgerService {
  public constructor(public readonly repository: LedgerRepository, private readonly clock: Clock) {}

  public async postLedgerTransaction(input: LedgerTransactionInput): Promise<LedgerPostingResult> {
    this.assertTransactionBalancesInEveryCurrency(input);
    return this.repository.postBalancedTransaction(input, this.clock.now());
  }

  public async readAccountBalance(account: LedgerAccountSpecification): Promise<MinorUnits> {
    return (await this.repository.findAccountByKey(account.key))?.balance ?? 0;
  }

  private assertTransactionBalancesInEveryCurrency(input: LedgerTransactionInput): void {
    if (input.lines.length < 2) throw unprocessable("A ledger transaction needs at least two lines.");
    for (const line of input.lines) {
      if (!Number.isSafeInteger(line.amount) || line.amount <= 0) throw unprocessable("Ledger amounts must be positive whole minor units.");
    }
    const debits = sumLineAmountsByCurrencyAndDirection(input, "debit");
    const credits = sumLineAmountsByCurrencyAndDirection(input, "credit");
    for (const currency of new Set([...debits.keys(), ...credits.keys()])) {
      if ((debits.get(currency) ?? 0) !== (credits.get(currency) ?? 0)) {
        throw unprocessable(`Ledger transaction debits and credits must be equal in ${currency}.`);
      }
    }
  }
}

export function buildLinesMovingMoneyBetweenCurrencies(
  debitAccount: LedgerAccountSpecification,
  debitAmount: Money,
  creditAccount: LedgerAccountSpecification,
  creditAmount: Money,
): readonly LedgerLineInput[] {
  if (debitAmount.equals(creditAmount)) {
    return [
      { account: debitAccount, direction: "debit", amount: debitAmount.amountMinor, currency: debitAmount.currency },
      { account: creditAccount, direction: "credit", amount: creditAmount.amountMinor, currency: creditAmount.currency },
    ];
  }
  return [
    { account: debitAccount, direction: "debit", amount: debitAmount.amountMinor, currency: debitAmount.currency },
    { account: LedgerAccounts.foreignExchangePosition(debitAmount.currency), direction: "credit", amount: debitAmount.amountMinor, currency: debitAmount.currency },
    { account: LedgerAccounts.foreignExchangePosition(creditAmount.currency), direction: "debit", amount: creditAmount.amountMinor, currency: creditAmount.currency },
    { account: creditAccount, direction: "credit", amount: creditAmount.amountMinor, currency: creditAmount.currency },
  ];
}
