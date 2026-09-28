import { QueryHandler } from "@zudojs/cqrs";

import type { WaitlistService } from "../../services/waitlist.service.js";
import type { CountWaitlistEntriesQuery } from "./countWaitlistEntries.query.js";

export class CountWaitlistEntriesHandler extends QueryHandler<CountWaitlistEntriesQuery, number> {
  public readonly queryType = "waitlist.countWaitlistEntries" as const;

  public constructor(private readonly waitlistService: WaitlistService) {
    super();
  }

  public execute(_query: CountWaitlistEntriesQuery): Promise<number> {
    return this.waitlistService.dependencies.entries.countEntries();
  }
}
