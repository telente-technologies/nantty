import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";
import type { ReviewSellerApplicationBody } from "../../validators/stores.validator.js";

export class ReviewSellerApplicationCommand extends Command<"stores.reviewSellerApplication"> {
  public constructor(
    public readonly principal: Principal,
    public readonly applicationId: string,
    public readonly input: ReviewSellerApplicationBody,
  ) {
    super("stores.reviewSellerApplication");
  }
}
