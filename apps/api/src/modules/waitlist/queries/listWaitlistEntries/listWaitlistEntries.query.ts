import { Query } from "@zudojs/cqrs";

import type { PageRequest } from "../../../../types/pagination.type.js";

export class ListWaitlistEntriesQuery extends Query<"waitlist.listWaitlistEntries"> {
  public constructor(
    public readonly page: PageRequest,
  ) {
    super("waitlist.listWaitlistEntries");
  }
}
