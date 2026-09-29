import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class ChangeCreatorStandingCommand extends Command<"creators.changeCreatorStanding"> {
  public constructor(
    public readonly principal: Principal,
    public readonly creatorId: string,
    public readonly action: "suspend" | "reinstate",
    public readonly reason: string | null,
  ) {
    super("creators.changeCreatorStanding");
  }
}
