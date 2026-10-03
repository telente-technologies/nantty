import type { ISODate } from "./models.type";
import type { Money } from "./money.type";

export interface StoreCreditBalance {
  readonly storeId: string;
  readonly storeName: string;
  readonly logoUrl: string | null;
  readonly balance: Money;
  readonly expiresAt: ISODate | null;
  readonly earnBackBasisPoints: number | null;
}
