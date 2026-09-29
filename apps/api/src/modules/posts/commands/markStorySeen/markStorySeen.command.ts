import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class MarkStorySeenCommand extends Command<"posts.markStorySeen"> {
  public constructor(
    public readonly principal: Principal,
    public readonly storyId: string,
  ) {
    super("posts.markStorySeen");
  }
}
