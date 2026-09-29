import { Query } from "@zudojs/cqrs";

import type { PageRequest } from "../../../../types/pagination.type.js";
import type { SupportTicketStatus } from "../../models/support.model.js";

export class ListSupportTicketsQuery extends Query<"support.listSupportTickets"> {
  public constructor(
    public readonly status: SupportTicketStatus | undefined,
    public readonly page: PageRequest,
  ) {
    super("support.listSupportTickets");
  }
}
