import { Query } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class ListMySellerApplicationsQuery extends Query<"stores.listMySellerApplications"> {
  public constructor(
    public readonly principal: Principal,
  ) {
    super("stores.listMySellerApplications");
  }
}
