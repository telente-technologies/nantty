import { Query } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class ListMyReportsQuery extends Query<"moderation.listMyReports"> {
  public constructor(
    public readonly principal: Principal,
  ) {
    super("moderation.listMyReports");
  }
}
