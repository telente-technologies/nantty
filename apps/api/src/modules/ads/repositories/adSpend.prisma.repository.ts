import { prisma } from "../../../integrations/database.integration.js";
import type { SpendCounterKey, SpendReservation } from "../models/adDelivery.model.js";
import { describeCounterKey, type AdSpendRepository } from "./adSpend.repository.js";

class BudgetExceededError extends Error {}

export class PrismaAdSpendRepository implements AdSpendRepository {
  public async reserveAll(reservations: readonly SpendReservation[]): Promise<boolean> {
    try {
      await prisma().$transaction(async (transaction) => {
        for (const reservation of reservations) {
          const key = { scopeId: reservation.scopeId, period: reservation.period };
          await transaction.adSpendCounter.upsert({ where: { scopeId_period: key }, create: { ...key, spentMilliMinor: 0n }, update: {} });
          const amount = BigInt(reservation.amountMilliMinor);
          const updated = await transaction.adSpendCounter.updateMany({
            where: { ...key, ...(reservation.limitMilliMinor === null ? {} : { spentMilliMinor: { lte: BigInt(reservation.limitMilliMinor) - amount } }) },
            data: { spentMilliMinor: { increment: amount } },
          });
          if (updated.count === 0) throw new BudgetExceededError();
        }
      });
      return true;
    } catch (error) {
      if (error instanceof BudgetExceededError) return false;
      throw error;
    }
  }

  public async release(reservations: readonly SpendReservation[]): Promise<void> {
    await prisma().$transaction(
      reservations.map((reservation) =>
        prisma().adSpendCounter.updateMany({
          where: { scopeId: reservation.scopeId, period: reservation.period },
          data: { spentMilliMinor: { decrement: BigInt(reservation.amountMilliMinor) } },
        })),
    );
  }

  public async readSpentMilliMinor(keys: readonly SpendCounterKey[]): Promise<ReadonlyMap<string, number>> {
    if (keys.length === 0) return new Map();
    const rows = await prisma().adSpendCounter.findMany({ where: { OR: keys.map((key) => ({ scopeId: key.scopeId, period: key.period })) } });
    const found = new Map(rows.map((row) => [describeCounterKey(row), Number(row.spentMilliMinor)]));
    return new Map(keys.map((key) => [describeCounterKey(key), found.get(describeCounterKey(key)) ?? 0]));
  }

  public async addToCounter(key: SpendCounterKey, deltaMilliMinor: number): Promise<number> {
    const row = await prisma().adSpendCounter.upsert({
      where: { scopeId_period: { scopeId: key.scopeId, period: key.period } },
      create: { scopeId: key.scopeId, period: key.period, spentMilliMinor: BigInt(deltaMilliMinor) },
      update: { spentMilliMinor: { increment: BigInt(deltaMilliMinor) } },
    });
    return Number(row.spentMilliMinor);
  }
}
