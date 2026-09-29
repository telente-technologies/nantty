import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";
import type { ResolveAppealBody } from "../../validators/moderation.validator.js";

export class ResolveAppealCommand extends Command<"moderation.resolveAppeal"> {
  public constructor(
    public readonly principal: Principal,
    public readonly appealId: string,
    public readonly input: ResolveAppealBody,
  ) {
    super("moderation.resolveAppeal");
  }
}
