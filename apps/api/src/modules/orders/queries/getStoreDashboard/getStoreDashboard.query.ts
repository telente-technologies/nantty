import { Query } from "@zudojs/cqrs";

import type { DashboardPeriod } from "../../services/storeDashboard.service.js";
import type { Principal } from "../../../../interfaces/principal.interface.js";

export class GetStoreDashboardQuery extends Query<"orders.getStoreDashboard"> {
  public constructor(
    public readonly principal: Principal,
    public readonly requestedStoreId: string | undefined,
    public readonly period: DashboardPeriod,
  ) {
    super("orders.getStoreDashboard");
  }
}
