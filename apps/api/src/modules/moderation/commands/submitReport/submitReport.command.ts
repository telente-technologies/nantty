import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";
import type { SubmitReportBody } from "../../validators/moderation.validator.js";

export class SubmitReportCommand extends Command<"moderation.submitReport"> {
  public constructor(
    public readonly principal: Principal,
    public readonly input: SubmitReportBody,
  ) {
    super("moderation.submitReport");
  }
}
