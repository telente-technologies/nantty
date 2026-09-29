import { Query } from "@zudojs/cqrs";

import type { DashboardPeriod } from "../../services/creatorDashboard.service.js";

export class GetCreatorDashboardQuery extends Query<"creators.getCreatorDashboard"> {
  public constructor(
    public readonly userId: string,
    public readonly period: DashboardPeriod,
  ) {
    super("creators.getCreatorDashboard");
  }
}
