import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";

export class UpdateAdAccountCommand extends Command<"ads.updateAdAccount"> {
  public constructor(
    public readonly principal: Principal,
    public readonly accountId: string,
    public readonly changes: { readonly name?: string; readonly timezone?: string },
  ) {
    super("ads.updateAdAccount");
  }
}
