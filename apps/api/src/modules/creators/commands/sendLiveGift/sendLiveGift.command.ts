import { Command } from "@zudojs/cqrs";

import type { LiveGiftRequest } from "../../services/liveGifts.service.js";
import type { Principal } from "../../../../interfaces/principal.interface.js";

export class SendLiveGiftCommand extends Command<"creators.sendLiveGift"> {
  public constructor(
    public readonly principal: Principal,
    public readonly request: Omit<LiveGiftRequest, "senderId">,
  ) {
    super("creators.sendLiveGift");
  }
}
