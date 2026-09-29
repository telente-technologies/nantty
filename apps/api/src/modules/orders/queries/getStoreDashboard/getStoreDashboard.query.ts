import { Query } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class GetStoreDashboardQuery extends Query<"orders.getStoreDashboard"> {
  public constructor(
    public readonly principal: Principal,
    public readonly storeId: string,
  ) {
    super("orders.getStoreDashboard");
  }
}
