import { Query } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class ListCheckoutPaymentsQuery extends Query<"payments.listCheckoutPayments"> {
  public constructor(
    public readonly principal: Principal,
    public readonly checkoutId: string,
  ) {
    super("payments.listCheckoutPayments");
  }
}
