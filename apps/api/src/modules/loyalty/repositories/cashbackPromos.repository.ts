import { randomUUID } from "node:crypto";

import type { CashbackPromo } from "../../../generated/prisma/client.js";
import { prisma } from "../../../integrations/database.integration.js";
import type { CashbackPromoRecord, NewCashbackPromo } from "../models/loyalty.model.js";

export interface CashbackPromosRepository {
  create(input: NewCashbackPromo): Promise<CashbackPromoRecord>;
  listAll(): Promise<readonly CashbackPromoRecord[]>;
  listActiveAt(moment: Date, storeId: string, categoryIds: readonly string[]): Promise<readonly CashbackPromoRecord[]>;
  deactivate(promoId: string): Promise<boolean>;
}

function isPromoLiveAt(promo: CashbackPromoRecord, moment: Date): boolean {
  return promo.active && promo.startsAt <= moment && (promo.endsAt === null || promo.endsAt > moment);
}

export class InMemoryCashbackPromosRepository implements CashbackPromosRepository {
  private readonly promos = new Map<string, CashbackPromoRecord>();

  public async create(input: NewCashbackPromo): Promise<CashbackPromoRecord> {
    const promo = { ...input, id: randomUUID() };
    this.promos.set(promo.id, promo);
    return promo;
  }

  public async listAll(): Promise<readonly CashbackPromoRecord[]> {
    return [...this.promos.values()];
  }

  public async listActiveAt(moment: Date, storeId: string, categoryIds: readonly string[]): Promise<readonly CashbackPromoRecord[]> {
    return [...this.promos.values()].filter((promo) => isPromoLiveAt(promo, moment) && (promo.storeId === storeId || (promo.categoryId !== null && categoryIds.includes(promo.categoryId))));
  }

  public async deactivate(promoId: string): Promise<boolean> {
    const promo = this.promos.get(promoId);
    if (promo === undefined) return false;
    this.promos.set(promoId, { ...promo, active: false });
    return true;
  }
}

export class PrismaCashbackPromosRepository implements CashbackPromosRepository {
  public async create(input: NewCashbackPromo): Promise<CashbackPromoRecord> {
    return prisma().cashbackPromo.create({ data: input });
  }

  public async listAll(): Promise<readonly CashbackPromoRecord[]> {
    return prisma().cashbackPromo.findMany({ orderBy: { createdAt: "desc" }, take: 500 });
  }

  public async listActiveAt(moment: Date, storeId: string, categoryIds: readonly string[]): Promise<readonly CashbackPromoRecord[]> {
    const rows: CashbackPromo[] = await prisma().cashbackPromo.findMany({
      where: {
        active: true,
        startsAt: { lte: moment },
        OR: [{ endsAt: null }, { endsAt: { gt: moment } }],
        AND: [{ OR: [{ storeId }, { categoryId: { in: [...categoryIds] } }] }],
      },
    });
    return rows;
  }

  public async deactivate(promoId: string): Promise<boolean> {
    return (await prisma().cashbackPromo.updateMany({ where: { id: promoId }, data: { active: false } })).count === 1;
  }
}
