import { Command } from "@zudojs/cqrs";

import type { TipRequest } from "../../services/tips.service.js";

export class SendTipCommand extends Command<"creators.sendTip"> {
  public constructor(
    public readonly request: TipRequest,
  ) {
    super("creators.sendTip");
  }
}
