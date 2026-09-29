import { Command } from "@zudojs/cqrs";

import type { FeedInteractionKind } from "../../models/feeds.model.js";
import type { Principal } from "../../../../interfaces/principal.interface.js";

export class RecordFeedInteractionCommand extends Command<"feeds.recordFeedInteraction"> {
  public constructor(
    public readonly principal: Principal,
    public readonly postId: string,
    public readonly kind: FeedInteractionKind,
  ) {
    super("feeds.recordFeedInteraction");
  }
}
