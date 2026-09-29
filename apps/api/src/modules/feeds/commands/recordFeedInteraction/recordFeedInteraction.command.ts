import { Command } from "@zudojs/cqrs";

import type { FeedInteractionKind, FeedInteractionSignals } from "../../models/feeds.model.js";
import type { Principal } from "../../../../interfaces/principal.interface.js";

export class RecordFeedInteractionCommand extends Command<"feeds.recordFeedInteraction"> {
  public constructor(
    public readonly principal: Principal,
    public readonly postId: string,
    public readonly interactionKind: FeedInteractionKind,
    public readonly signals: FeedInteractionSignals,
    public readonly country: string | null,
  ) {
    super("feeds.recordFeedInteraction");
  }
}
