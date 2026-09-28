import { Query } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class ListAddressesQuery extends Query<"users.listAddresses"> {
  public constructor(
    public readonly principal: Principal,
  ) {
    super("users.listAddresses");
  }
}
