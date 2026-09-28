import { Query } from "@zudojs/cqrs";

export class CountWaitlistEntriesQuery extends Query<"waitlist.countWaitlistEntries"> {
  public constructor() {
    super("waitlist.countWaitlistEntries");
  }
}
