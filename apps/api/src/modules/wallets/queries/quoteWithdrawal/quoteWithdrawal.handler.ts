import { QueryHandler } from "@zudojs/cqrs";

import type { WithdrawalQuote, WithdrawalsService } from "../../services/withdrawals.service.js";
import type { QuoteWithdrawalQuery } from "./quoteWithdrawal.query.js";

export class QuoteWithdrawalHandler extends QueryHandler<QuoteWithdrawalQuery, WithdrawalQuote> {
  public readonly queryType = "wallets.quoteWithdrawal" as const;

  public constructor(private readonly service: WithdrawalsService) {
    super();
  }

  public execute(query: QuoteWithdrawalQuery): Promise<WithdrawalQuote> {
    return this.service.quoteWithdrawal(query.principal, query.scope, query.amount, query.payoutAccountId);
  }
}
