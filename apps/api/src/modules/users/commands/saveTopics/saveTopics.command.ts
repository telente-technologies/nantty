import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class SaveTopicsCommand extends Command<"users.saveTopics"> {
  public constructor(
    public readonly principal: Principal,
    public readonly topicIds: readonly string[],
  ) {
    super("users.saveTopics");
  }
}
