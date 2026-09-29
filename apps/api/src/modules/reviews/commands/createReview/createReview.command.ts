import { Command } from "@zudojs/cqrs";

import type { CreateReviewBody } from "../../validators/reviews.validator.js";
import type { Principal } from "../../../../interfaces/principal.interface.js";

export class CreateReviewCommand extends Command<"reviews.createReview"> {
  public constructor(
    public readonly principal: Principal,
    public readonly productId: string,
    public readonly input: CreateReviewBody,
  ) {
    super("reviews.createReview");
  }
}
