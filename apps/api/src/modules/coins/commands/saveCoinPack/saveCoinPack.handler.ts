import { CommandHandler } from "@zudojs/cqrs";

import type { CoinPackDto } from "../../dtos/coins.dto.js";
import type { CoinsServices } from "../../services/coinsServices.service.js";
import type { SaveCoinPackCommand } from "./saveCoinPack.command.js";

export class SaveCoinPackHandler extends CommandHandler<SaveCoinPackCommand, CoinPackDto> {
  public readonly commandType = "coins.saveCoinPack" as const;

  public constructor(private readonly service: CoinsServices) {
    super();
  }

  public execute(command: SaveCoinPackCommand): Promise<CoinPackDto> {
    return this.service.packs.savePack(command.adminId, command.pack);
  }
}
