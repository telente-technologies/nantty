import { Query } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class GetAdAccountQuery extends Query<"ads.getAdAccount"> {
  public constructor(
    public readonly principal: Principal,
    public readonly accountId: string,
  ) {
    super("ads.getAdAccount");
  }
}
