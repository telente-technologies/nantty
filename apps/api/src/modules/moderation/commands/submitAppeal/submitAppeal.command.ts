import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class SubmitAppealCommand extends Command<"moderation.submitAppeal"> {
  public constructor(
    public readonly principal: Principal,
    public readonly decisionId: string,
    public readonly statement: string,
  ) {
    super("moderation.submitAppeal");
  }
}
