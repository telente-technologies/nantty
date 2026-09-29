import { CommandHandler } from "@zudojs/cqrs";

import type { FeedSignalsService } from "../../services/feedSignals.service.js";
import type { RecordFeedFeedbackCommand } from "./recordFeedFeedback.command.js";

export class RecordFeedFeedbackHandler extends CommandHandler<RecordFeedFeedbackCommand, void> {
  public readonly commandType = "feeds.recordFeedFeedback" as const;

  public constructor(private readonly feedSignals: FeedSignalsService) {
    super();
  }

  public execute(command: RecordFeedFeedbackCommand): Promise<void> {
    return this.feedSignals.recordFeedback(command.principal, command.postId, command.feedbackType, command.country);
  }
}
