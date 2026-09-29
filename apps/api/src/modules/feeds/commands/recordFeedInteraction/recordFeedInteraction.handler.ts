import { CommandHandler } from "@zudojs/cqrs";

import type { FeedSignalsService } from "../../services/feedSignals.service.js";
import type { RecordFeedInteractionCommand } from "./recordFeedInteraction.command.js";

export class RecordFeedInteractionHandler extends CommandHandler<RecordFeedInteractionCommand, void> {
  public readonly commandType = "feeds.recordFeedInteraction" as const;

  public constructor(private readonly feedSignals: FeedSignalsService) {
    super();
  }

  public execute(command: RecordFeedInteractionCommand): Promise<void> {
    return this.feedSignals.recordInteraction(command.principal, command.postId, command.interactionKind, command.signals, command.country);
  }
}
