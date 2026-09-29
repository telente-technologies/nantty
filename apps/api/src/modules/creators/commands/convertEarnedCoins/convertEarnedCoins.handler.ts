import { CommandHandler } from "@zudojs/cqrs";

import type { CoinConversionReceiptDto } from "../../dtos/creators.dto.js";
import type { CreatorProgramServices } from "../../services/creatorProgramServices.service.js";
import type { ConvertEarnedCoinsCommand } from "./convertEarnedCoins.command.js";

export class ConvertEarnedCoinsHandler extends CommandHandler<ConvertEarnedCoinsCommand, CoinConversionReceiptDto> {
  public readonly commandType = "creators.convertEarnedCoins" as const;

  public constructor(private readonly service: CreatorProgramServices) {
    super();
  }

  public execute(command: ConvertEarnedCoinsCommand): Promise<CoinConversionReceiptDto> {
    return this.service.cashOut.convertEarnedCoinsToCash(command.request);
  }
}
