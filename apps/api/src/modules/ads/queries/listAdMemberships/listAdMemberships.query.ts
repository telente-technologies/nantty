import { Query } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class ListAdMembershipsQuery extends Query<"ads.listAdMemberships"> {
  public constructor(
    public readonly principal: Principal,
  ) {
    super("ads.listAdMemberships");
  }
}
