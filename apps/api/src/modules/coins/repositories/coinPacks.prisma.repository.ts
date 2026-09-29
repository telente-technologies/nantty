import type { CoinPack } from "../../../generated/prisma/client.js";
import { prisma } from "../../../integrations/database.integration.js";
import type { CoinPackInput, CoinPackRecord } from "../models/coins.model.js";
import { sortPacksForDisplay, type CoinPacksRepository } from "./coinPacks.repository.js";

function convertCoinPackRow(row: CoinPack): CoinPackRecord {
  return { ...row, prices: row.prices as CoinPackRecord["prices"] };
}

export class PrismaCoinPacksRepository implements CoinPacksRepository {
  public async listPacks(includeInactive: boolean): Promise<readonly CoinPackRecord[]> {
    const rows = await prisma().coinPack.findMany({ where: includeInactive ? {} : { active: true } });
    return sortPacksForDisplay(rows.map(convertCoinPackRow));
  }

  public async findPack(packId: string): Promise<CoinPackRecord | undefined> {
    const row = await prisma().coinPack.findUnique({ where: { id: packId } });
    return row === null ? undefined : convertCoinPackRow(row);
  }

  public async findPackByStoreProductId(storeProductId: string): Promise<CoinPackRecord | undefined> {
    const row = await prisma().coinPack.findFirst({ where: { storeProductId } });
    return row === null ? undefined : convertCoinPackRow(row);
  }

  public async savePack(pack: CoinPackInput, savedAt: Date): Promise<CoinPackRecord> {
    const data = { ...pack, prices: { ...pack.prices }, updatedAt: savedAt };
    return convertCoinPackRow(await prisma().coinPack.upsert({ where: { id: pack.id }, create: data, update: data }));
  }
}
