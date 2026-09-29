import type { SpendCounterKey, SpendReservation } from "../models/adDelivery.model.js";

export interface AdSpendRepository {
  reserveAll(reservations: readonly SpendReservation[]): Promise<boolean>;
  release(reservations: readonly SpendReservation[]): Promise<void>;
  readSpentMilliMinor(keys: readonly SpendCounterKey[]): Promise<ReadonlyMap<string, number>>;
  addToCounter(key: SpendCounterKey, deltaMilliMinor: number): Promise<number>;
}

export function describeCounterKey(key: SpendCounterKey): string {
  return `${key.scopeId}|${key.period}`;
}

export class InMemoryAdSpendRepository implements AdSpendRepository {
  private readonly counters = new Map<string, number>();

  public async reserveAll(reservations: readonly SpendReservation[]): Promise<boolean> {
    const fits = reservations.every((reservation) => {
      const spent = this.counters.get(describeCounterKey(reservation)) ?? 0;
      return reservation.limitMilliMinor === null || spent + reservation.amountMilliMinor <= reservation.limitMilliMinor;
    });
    if (!fits) return false;
    for (const reservation of reservations) {
      const key = describeCounterKey(reservation);
      this.counters.set(key, (this.counters.get(key) ?? 0) + reservation.amountMilliMinor);
    }
    return true;
  }

  public async release(reservations: readonly SpendReservation[]): Promise<void> {
    for (const reservation of reservations) {
      const key = describeCounterKey(reservation);
      this.counters.set(key, Math.max(0, (this.counters.get(key) ?? 0) - reservation.amountMilliMinor));
    }
  }

  public async readSpentMilliMinor(keys: readonly SpendCounterKey[]): Promise<ReadonlyMap<string, number>> {
    return new Map(keys.map((key) => [describeCounterKey(key), this.counters.get(describeCounterKey(key)) ?? 0]));
  }

  public async addToCounter(key: SpendCounterKey, deltaMilliMinor: number): Promise<number> {
    const next = (this.counters.get(describeCounterKey(key)) ?? 0) + deltaMilliMinor;
    this.counters.set(describeCounterKey(key), next);
    return next;
  }
}
