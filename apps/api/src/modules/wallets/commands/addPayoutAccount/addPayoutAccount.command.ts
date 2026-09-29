import { Command } from "@zudojs/cqrs";

import type { NewPayoutAccountInput } from "../../services/wallets.service.js";
import type { Principal } from "../../../../interfaces/principal.interface.js";

export class AddPayoutAccountCommand extends Command<"wallets.addPayoutAccount"> {
  public constructor(
    public readonly principal: Principal,
    public readonly storeId: string | undefined,
    public readonly input: NewPayoutAccountInput,
  ) {
    super("wallets.addPayoutAccount");
  }
}
