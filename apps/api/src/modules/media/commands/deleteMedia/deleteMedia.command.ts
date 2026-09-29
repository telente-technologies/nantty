import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class DeleteMediaCommand extends Command<"media.deleteMedia"> {
  public constructor(
    public readonly principal: Principal,
    public readonly mediaId: string,
  ) {
    super("media.deleteMedia");
  }
}
