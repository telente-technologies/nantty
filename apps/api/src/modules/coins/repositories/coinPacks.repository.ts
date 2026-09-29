import type { CoinPackInput, CoinPackRecord } from "../models/coins.model.js";
import { DEFAULT_COIN_PACKS } from "../seeds/defaultCoinPacks.seed.js";

export interface CoinPacksRepository {
  listPacks(includeInactive: boolean): Promise<readonly CoinPackRecord[]>;
  findPack(packId: string): Promise<CoinPackRecord | undefined>;
  findPackByStoreProductId(storeProductId: string): Promise<CoinPackRecord | undefined>;
  savePack(pack: CoinPackInput, savedAt: Date): Promise<CoinPackRecord>;
}

export function sortPacksForDisplay(packs: readonly CoinPackRecord[]): CoinPackRecord[] {
  return [...packs].sort((left, right) => left.sortOrder - right.sortOrder || left.coins - right.coins);
}

export class InMemoryCoinPacksRepository implements CoinPacksRepository {
  private readonly packs = new Map<string, CoinPackRecord>(DEFAULT_COIN_PACKS.map((pack) => [pack.id, { ...pack, updatedAt: new Date(0) }]));

  public async listPacks(includeInactive: boolean): Promise<readonly CoinPackRecord[]> {
    return sortPacksForDisplay([...this.packs.values()].filter((pack) => includeInactive || pack.active));
  }

  public async findPack(packId: string): Promise<CoinPackRecord | undefined> {
    return this.packs.get(packId);
  }

  public async findPackByStoreProductId(storeProductId: string): Promise<CoinPackRecord | undefined> {
    return [...this.packs.values()].find((pack) => pack.storeProductId === storeProductId);
  }

  public async savePack(pack: CoinPackInput, savedAt: Date): Promise<CoinPackRecord> {
    const saved = { ...pack, updatedAt: savedAt };
    this.packs.set(pack.id, saved);
    return saved;
  }
}
