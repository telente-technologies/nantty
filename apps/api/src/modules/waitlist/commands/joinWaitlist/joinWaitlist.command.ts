import { Command } from "@zudojs/cqrs";

import type { JoinWaitlistBody } from "../../validators/waitlist.validator.js";

export class JoinWaitlistCommand extends Command<"waitlist.joinWaitlist"> {
  public constructor(
    public readonly input: JoinWaitlistBody,
  ) {
    super("waitlist.joinWaitlist");
  }
}
