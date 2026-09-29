import { Query } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class GetPaymentQuery extends Query<"payments.getPayment"> {
  public constructor(
    public readonly principal: Principal,
    public readonly paymentId: string,
  ) {
    super("payments.getPayment");
  }
}
