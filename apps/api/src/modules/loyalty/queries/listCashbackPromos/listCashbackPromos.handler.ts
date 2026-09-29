import { QueryHandler } from "@zudojs/cqrs";

import type { CashbackPromoRecord } from "../../models/loyalty.model.js";
import type { LoyaltyServices } from "../../services/loyaltyServices.service.js";
import type { ListCashbackPromosQuery } from "./listCashbackPromos.query.js";

export class ListCashbackPromosHandler extends QueryHandler<ListCashbackPromosQuery, readonly CashbackPromoRecord[]> {
  public readonly queryType = "loyalty.listCashbackPromos" as const;

  public constructor(private readonly service: LoyaltyServices) {
    super();
  }

  public execute(query: ListCashbackPromosQuery): Promise<readonly CashbackPromoRecord[]> {
    return this.service.cashback.listPromos();
  }
}
