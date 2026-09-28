import { QueryHandler } from "@zudojs/cqrs";

import type { Page } from "../../../../types/pagination.type.js";
import type { WaitlistEntryRecord } from "../../models/waitlist.model.js";
import type { WaitlistService } from "../../services/waitlist.service.js";
import type { ListWaitlistEntriesQuery } from "./listWaitlistEntries.query.js";

export class ListWaitlistEntriesHandler extends QueryHandler<ListWaitlistEntriesQuery, Page<WaitlistEntryRecord>> {
  public readonly queryType = "waitlist.listWaitlistEntries" as const;

  public constructor(private readonly waitlistService: WaitlistService) {
    super();
  }

  public execute(query: ListWaitlistEntriesQuery): Promise<Page<WaitlistEntryRecord>> {
    return this.waitlistService.dependencies.entries.list(query.page);
  }
}
