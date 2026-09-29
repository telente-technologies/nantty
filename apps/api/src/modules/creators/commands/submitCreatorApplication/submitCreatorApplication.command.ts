import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class SubmitCreatorApplicationCommand extends Command<"creators.submitCreatorApplication"> {
  public constructor(
    public readonly principal: Principal,
  ) {
    super("creators.submitCreatorApplication");
  }
}
