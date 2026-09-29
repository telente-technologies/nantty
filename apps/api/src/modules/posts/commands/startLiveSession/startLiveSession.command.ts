import { Command } from "@zudojs/cqrs";

import type { CurrencyCode } from "../../../../enums/currency.enum.js";
import type { Principal } from "../../../../interfaces/principal.interface.js";
import type { StartLiveBody } from "../../validators/posts.validator.js";

export class StartLiveSessionCommand extends Command<"posts.startLiveSession"> {
  public constructor(
    public readonly principal: Principal,
    public readonly input: StartLiveBody,
    public readonly displayCurrency: CurrencyCode,
  ) {
    super("posts.startLiveSession");
  }
}
