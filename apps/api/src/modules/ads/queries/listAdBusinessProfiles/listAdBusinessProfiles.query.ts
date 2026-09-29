import { Query } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class ListAdBusinessProfilesQuery extends Query<"ads.listAdBusinessProfiles"> {
  public constructor(
    public readonly principal: Principal,
  ) {
    super("ads.listAdBusinessProfiles");
  }
}
