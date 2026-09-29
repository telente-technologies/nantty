import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class ReplyToStoryCommand extends Command<"posts.replyToStory"> {
  public constructor(
    public readonly principal: Principal,
    public readonly storyId: string,
    public readonly text: string,
  ) {
    super("posts.replyToStory");
  }
}
