import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";
import type { SubmitSellerApplicationBody } from "../../validators/stores.validator.js";

export class SubmitSellerApplicationCommand extends Command<"stores.submitSellerApplication"> {
  public constructor(
    public readonly principal: Principal,
    public readonly input: SubmitSellerApplicationBody,
  ) {
    super("stores.submitSellerApplication");
  }
}
