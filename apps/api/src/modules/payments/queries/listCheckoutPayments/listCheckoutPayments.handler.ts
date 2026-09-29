import { QueryHandler } from "@zudojs/cqrs";

import type { PaymentRecord } from "../../models/payments.model.js";
import type { PaymentsService } from "../../services/payments.service.js";
import type { ListCheckoutPaymentsQuery } from "./listCheckoutPayments.query.js";

export class ListCheckoutPaymentsHandler extends QueryHandler<ListCheckoutPaymentsQuery, readonly PaymentRecord[]> {
  public readonly queryType = "payments.listCheckoutPayments" as const;

  public constructor(private readonly service: PaymentsService) {
    super();
  }

  public execute(query: ListCheckoutPaymentsQuery): Promise<readonly PaymentRecord[]> {
    return this.service.listCheckoutPaymentsForBuyer(query.principal.userId, query.checkoutId);
  }
}
