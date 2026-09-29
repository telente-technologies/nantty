import { Command } from "@zudojs/cqrs";

import type { PostGiftRequest } from "../../services/liveGifts.service.js";

export class SendPostGiftCommand extends Command<"creators.sendPostGift"> {
  public constructor(
    public readonly request: PostGiftRequest,
  ) {
    super("creators.sendPostGift");
  }
}
