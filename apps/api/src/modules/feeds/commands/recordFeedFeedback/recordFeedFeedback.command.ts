import { Command } from "@zudojs/cqrs";

import type { FeedFeedbackType } from "../../services/feedSignals.service.js";
import type { Principal } from "../../../../interfaces/principal.interface.js";

export class RecordFeedFeedbackCommand extends Command<"feeds.recordFeedFeedback"> {
  public constructor(
    public readonly principal: Principal,
    public readonly postId: string,
    public readonly feedbackType: FeedFeedbackType,
    public readonly country: string | null,
  ) {
    super("feeds.recordFeedFeedback");
  }
}
