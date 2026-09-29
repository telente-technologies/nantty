import { chooseChargeCurrencyForDisplayCurrency } from "../../../configs/currency.config.js";
import type { CurrencyCode } from "../../../enums/currency.enum.js";
import type { AuditRecorder } from "../../../interfaces/audit.interface.js";
import type { Clock } from "../../../interfaces/clock.interface.js";
import { Money } from "../../../utils/money.util.js";
import type { CoinPackDto } from "../dtos/coins.dto.js";
import type { CoinPackInput, CoinPackRecord } from "../models/coins.model.js";
import type { CoinPacksRepository } from "../repositories/coinPacks.repository.js";
import { choosePackPrice } from "./coinPurchases.service.js";

export function presentCoinPack(pack: CoinPackRecord, displayCurrency: CurrencyCode): CoinPackDto {
  const price = choosePackPrice(pack, chooseChargeCurrencyForDisplayCurrency(displayCurrency));
  return {
    id: pack.id,
    name: pack.name,
    coins: pack.coins,
    bonusCoins: pack.bonusCoins,
    totalCoins: pack.coins + pack.bonusCoins,
    storeProductId: pack.storeProductId,
    active: pack.active,
    price: Money.of(price.amount, price.currency).toDto(),
    prices: Object.entries(pack.prices).map(([currency, amount]) => Money.of(amount, currency).toDto()),
  };
}

export class CoinPacksService {
  public constructor(private readonly packs: CoinPacksRepository, private readonly audit: AuditRecorder, private readonly clock: Clock) {}

  public async listPacks(displayCurrency: CurrencyCode, includeInactive: boolean): Promise<readonly CoinPackDto[]> {
    return (await this.packs.listPacks(includeInactive)).map((pack) => presentCoinPack(pack, displayCurrency));
  }

  public async savePack(adminId: string, pack: CoinPackInput): Promise<CoinPackDto> {
    const before = await this.packs.findPack(pack.id);
    const saved = await this.packs.savePack(pack, this.clock.now());
    await this.audit.record({ actorId: adminId, action: before === undefined ? "coins.pack_created" : "coins.pack_updated", entityType: "coin_pack", entityId: pack.id, metadata: { before: before ?? null, after: pack } });
    return presentCoinPack(saved, "USD");
  }
}
