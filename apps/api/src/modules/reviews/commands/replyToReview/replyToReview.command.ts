import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class ReplyToReviewCommand extends Command<"reviews.replyToReview"> {
  public constructor(
    public readonly principal: Principal,
    public readonly reviewId: string,
    public readonly reply: string,
  ) {
    super("reviews.replyToReview");
  }
}
