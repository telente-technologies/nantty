import { Command } from "@zudojs/cqrs";

import type { ContactRequestBody } from "../../validators/support.validator.js";
import type { Principal } from "../../../../interfaces/principal.interface.js";

export class SubmitContactRequestCommand extends Command<"support.submitContactRequest"> {
  public constructor(
    public readonly principal: Principal | undefined,
    public readonly input: ContactRequestBody,
  ) {
    super("support.submitContactRequest");
  }
}
