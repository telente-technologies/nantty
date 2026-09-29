import { QueryHandler } from "@zudojs/cqrs";

import type { StoreDashboardService } from "../../services/storeDashboard.service.js";
import type { StoreDashboard } from "../../services/storeDashboard.service.js";
import type { GetStoreDashboardQuery } from "./getStoreDashboard.query.js";

export class GetStoreDashboardHandler extends QueryHandler<GetStoreDashboardQuery, StoreDashboard> {
  public readonly queryType = "orders.getStoreDashboard" as const;

  public constructor(private readonly service: StoreDashboardService) {
    super();
  }

  public execute(query: GetStoreDashboardQuery): Promise<StoreDashboard> {
    return this.service.buildStoreDashboard(query.principal.userId, query.storeId);
  }
}
