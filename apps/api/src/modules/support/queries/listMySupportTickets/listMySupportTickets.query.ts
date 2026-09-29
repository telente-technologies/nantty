import { Query } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class ListMySupportTicketsQuery extends Query<"support.listMySupportTickets"> {
  public constructor(
    public readonly principal: Principal,
  ) {
    super("support.listMySupportTickets");
  }
}
