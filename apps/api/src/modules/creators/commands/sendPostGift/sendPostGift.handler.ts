import { CommandHandler } from "@zudojs/cqrs";

import type { CreatorProgramServices } from "../../services/creatorProgramServices.service.js";
import type { GiftReceiptDto } from "../../dtos/creators.dto.js";
import type { SendPostGiftCommand } from "./sendPostGift.command.js";

export class SendPostGiftHandler extends CommandHandler<SendPostGiftCommand, GiftReceiptDto> {
  public readonly commandType = "creators.sendPostGift" as const;

  public constructor(private readonly service: CreatorProgramServices) {
    super();
  }

  public execute(command: SendPostGiftCommand): Promise<GiftReceiptDto> {
    return this.service.gifts.sendPostGift(command.request);
  }
}
