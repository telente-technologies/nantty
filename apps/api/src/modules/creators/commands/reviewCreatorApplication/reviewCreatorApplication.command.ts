import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";
import type { ReviewCreatorApplicationBody } from "../../validators/creators.validator.js";

export class ReviewCreatorApplicationCommand extends Command<"creators.reviewCreatorApplication"> {
  public constructor(
    public readonly principal: Principal,
    public readonly applicationId: string,
    public readonly input: ReviewCreatorApplicationBody,
  ) {
    super("creators.reviewCreatorApplication");
  }
}
