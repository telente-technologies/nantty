import { CommandHandler } from "@zudojs/cqrs";

import type { FeedSignalsService } from "../../services/feedSignals.service.js";
import type { RecordProductInteractionCommand } from "./recordProductInteraction.command.js";

export class RecordProductInteractionHandler extends CommandHandler<RecordProductInteractionCommand, void> {
  public readonly commandType = "feeds.recordProductInteraction" as const;

  public constructor(private readonly feedSignals: FeedSignalsService) {
    super();
  }

  public execute(command: RecordProductInteractionCommand): Promise<void> {
    return this.feedSignals.recordProductInteraction(command.principal, command.signal, command.country);
  }
}
