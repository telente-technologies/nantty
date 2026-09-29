import { Query } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class ListAdActivityQuery extends Query<"ads.listAdActivity"> {
  public constructor(
    public readonly principal: Principal,
    public readonly accountId: string,
    public readonly objectType: string | undefined,
    public readonly cursor: string | undefined,
    public readonly limit: number,
  ) {
    super("ads.listAdActivity");
  }
}
