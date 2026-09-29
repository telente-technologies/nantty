import { randomUUID } from "node:crypto";

import type { CurrencyCode } from "../../../enums/currency.enum.js";
import type { MinorUnits } from "../../../types/money.type.js";
import type { Page, PageRequest } from "../../../types/pagination.type.js";
import { compareByNewestFirst, paginateSortedItems } from "../../../utils/pagination.util.js";
import type { CreatorEarningKind, CreatorEarningRecord, LiveGiftRecord, NewCreatorEarning, NewLiveGift } from "../models/creators.model.js";

export interface EarningTotal {
  readonly kind: CreatorEarningKind;
  readonly currency: CurrencyCode;
  readonly netAmount: MinorUnits;
  readonly count: number;
}

export interface CreatorEarningsRepository {
  recordEarningIfNew(earning: NewCreatorEarning): Promise<boolean>;
  listEarnings(creatorId: string, page: PageRequest): Promise<Page<CreatorEarningRecord>>;
  sumEarningsSince(creatorId: string, since: Date | null): Promise<readonly EarningTotal[]>;
  recordLiveGiftIfNew(gift: NewLiveGift): Promise<{ readonly gift: LiveGiftRecord; readonly created: boolean }>;
}

export class InMemoryCreatorEarningsRepository implements CreatorEarningsRepository {
  private readonly earnings = new Map<string, CreatorEarningRecord>();
  private readonly gifts = new Map<string, LiveGiftRecord>();

  public async recordEarningIfNew(earning: NewCreatorEarning): Promise<boolean> {
    if (this.earnings.has(earning.reference)) return false;
    this.earnings.set(earning.reference, { ...earning, id: randomUUID() });
    return true;
  }

  public async listEarnings(creatorId: string, page: PageRequest): Promise<Page<CreatorEarningRecord>> {
    const matches = [...this.earnings.values()].filter((earning) => earning.creatorId === creatorId).sort(compareByNewestFirst);
    return paginateSortedItems(matches, page);
  }

  public async sumEarningsSince(creatorId: string, since: Date | null): Promise<readonly EarningTotal[]> {
    const totals = new Map<string, EarningTotal>();
    for (const earning of this.earnings.values()) {
      if (earning.creatorId !== creatorId || (since !== null && earning.createdAt < since)) continue;
      const key = `${earning.kind}:${earning.currency}`;
      const current = totals.get(key) ?? { kind: earning.kind, currency: earning.currency, netAmount: 0, count: 0 };
      totals.set(key, { ...current, netAmount: current.netAmount + earning.netAmount, count: current.count + 1 });
    }
    return [...totals.values()];
  }

  public async recordLiveGiftIfNew(gift: NewLiveGift): Promise<{ readonly gift: LiveGiftRecord; readonly created: boolean }> {
    const existing = this.gifts.get(gift.reference);
    if (existing !== undefined) return { gift: existing, created: false };
    const created = { ...gift, id: randomUUID() };
    this.gifts.set(gift.reference, created);
    return { gift: created, created: true };
  }
}
