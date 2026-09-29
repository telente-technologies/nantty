import { CommandHandler } from "@zudojs/cqrs";

import type { LiveGiftReceiptDto } from "../../dtos/creators.dto.js";
import type { CreatorProgramServices } from "../../services/creatorProgramServices.service.js";
import type { SendLiveGiftCommand } from "./sendLiveGift.command.js";

export class SendLiveGiftHandler extends CommandHandler<SendLiveGiftCommand, LiveGiftReceiptDto> {
  public readonly commandType = "creators.sendLiveGift" as const;

  public constructor(private readonly services: CreatorProgramServices) {
    super();
  }

  public execute(command: SendLiveGiftCommand): Promise<LiveGiftReceiptDto> {
    return this.services.gifts.sendLiveGift({ ...command.request, senderId: command.principal.userId });
  }
}
