import { Query } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class GetCartQuery extends Query<"carts.getCart"> {
  public constructor(
    public readonly principal: Principal,
  ) {
    super("carts.getCart");
  }
}
