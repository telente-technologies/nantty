import { Query } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class SearchMessagesQuery extends Query<"messages.searchMessages"> {
  public constructor(
    public readonly principal: Principal,
    public readonly searchTerm: string,
  ) {
    super("messages.searchMessages");
  }
}
