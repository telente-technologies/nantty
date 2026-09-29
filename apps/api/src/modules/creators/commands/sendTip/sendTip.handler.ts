import { CommandHandler } from "@zudojs/cqrs";

import type { CreatorProgramServices } from "../../services/creatorProgramServices.service.js";
import type { TipReceiptDto } from "../../dtos/creators.dto.js";
import type { SendTipCommand } from "./sendTip.command.js";

export class SendTipHandler extends CommandHandler<SendTipCommand, TipReceiptDto> {
  public readonly commandType = "creators.sendTip" as const;

  public constructor(private readonly service: CreatorProgramServices) {
    super();
  }

  public execute(command: SendTipCommand): Promise<TipReceiptDto> {
    return this.service.tips.sendTip(command.request);
  }
}
