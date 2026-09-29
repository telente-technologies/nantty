import { QueryHandler } from "@zudojs/cqrs";

import type { PaymentRecord } from "../../models/payments.model.js";
import type { PaymentsService } from "../../services/payments.service.js";
import type { GetPaymentQuery } from "./getPayment.query.js";

export class GetPaymentHandler extends QueryHandler<GetPaymentQuery, PaymentRecord> {
  public readonly queryType = "payments.getPayment" as const;

  public constructor(private readonly service: PaymentsService) {
    super();
  }

  public execute(query: GetPaymentQuery): Promise<PaymentRecord> {
    return this.service.findPaymentForBuyer(query.principal.userId, query.paymentId);
  }
}
