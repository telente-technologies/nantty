import type { SpendCounterKey, SpendReservation } from "../models/adDelivery.model.js";

export interface AdSpendRepository {
  reserveAll(reservations: readonly SpendReservation[]): Promise<boolean>;
  release(reservations: readonly SpendReservation[]): Promise<void>;
  readSpentMicros(keys: readonly SpendCounterKey[]): Promise<ReadonlyMap<string, number>>;
  addToCounter(key: SpendCounterKey, deltaMicros: number): Promise<number>;
}

export function describeCounterKey(key: SpendCounterKey): string {
  return `${key.scopeId}|${key.period}`;
}

export class InMemoryAdSpendRepository implements AdSpendRepository {
  private readonly counters = new Map<string, number>();

  public async reserveAll(reservations: readonly SpendReservation[]): Promise<boolean> {
    const fits = reservations.every((reservation) => {
      const spent = this.counters.get(describeCounterKey(reservation)) ?? 0;
      return reservation.limitMicros === null || spent + reservation.amountMicros <= reservation.limitMicros;
    });
    if (!fits) return false;
    for (const reservation of reservations) {
      const key = describeCounterKey(reservation);
      this.counters.set(key, (this.counters.get(key) ?? 0) + reservation.amountMicros);
    }
    return true;
  }

  public async release(reservations: readonly SpendReservation[]): Promise<void> {
    for (const reservation of reservations) {
      const key = describeCounterKey(reservation);
      this.counters.set(key, Math.max(0, (this.counters.get(key) ?? 0) - reservation.amountMicros));
    }
  }

  public async readSpentMicros(keys: readonly SpendCounterKey[]): Promise<ReadonlyMap<string, number>> {
    return new Map(keys.map((key) => [describeCounterKey(key), this.counters.get(describeCounterKey(key)) ?? 0]));
  }

  public async addToCounter(key: SpendCounterKey, deltaMicros: number): Promise<number> {
    const next = (this.counters.get(describeCounterKey(key)) ?? 0) + deltaMicros;
    this.counters.set(describeCounterKey(key), next);
    return next;
  }
}
