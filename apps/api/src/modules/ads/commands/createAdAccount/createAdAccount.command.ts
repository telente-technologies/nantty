import { Command } from "@zudojs/cqrs";

import type { CreateAdAccountInput } from "../../services/adAccounts.service.js";
import type { Principal } from "../../../../interfaces/principal.interface.js";

export class CreateAdAccountCommand extends Command<"ads.createAdAccount"> {
  public constructor(
    public readonly principal: Principal,
    public readonly input: CreateAdAccountInput,
  ) {
    super("ads.createAdAccount");
  }
}
