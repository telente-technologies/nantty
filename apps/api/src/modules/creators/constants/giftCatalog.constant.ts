import type { CurrencyCode } from "../../../enums/currency.enum.js";
import type { MinorUnits } from "../../../types/money.type.js";

export interface GiftDefinition {
  readonly id: string;
  readonly name: string;
  readonly emoji: string;
  readonly pricesInMinorUnits: Readonly<Record<CurrencyCode, MinorUnits>>;
}

export const GIFT_CATALOG: readonly GiftDefinition[] = [
  { id: "rose", name: "Rose", emoji: "🌹", pricesInMinorUnits: { NGN: 10_000, GHS: 150, KES: 1_300, ZAR: 200, GBP: 10, EUR: 10, USD: 10 } },
  { id: "heart", name: "Heart", emoji: "💖", pricesInMinorUnits: { NGN: 50_000, GHS: 700, KES: 6_500, ZAR: 900, GBP: 40, EUR: 50, USD: 50 } },
  { id: "fire", name: "Fire", emoji: "🔥", pricesInMinorUnits: { NGN: 100_000, GHS: 1_500, KES: 13_000, ZAR: 1_800, GBP: 80, EUR: 90, USD: 100 } },
  { id: "crown", name: "Crown", emoji: "👑", pricesInMinorUnits: { NGN: 500_000, GHS: 7_500, KES: 65_000, ZAR: 9_000, GBP: 400, EUR: 460, USD: 500 } },
  { id: "rocket", name: "Rocket", emoji: "🚀", pricesInMinorUnits: { NGN: 2_000_000, GHS: 30_000, KES: 260_000, ZAR: 36_000, GBP: 1_600, EUR: 1_850, USD: 2_000 } },
];

export function findGiftDefinition(giftId: string): GiftDefinition | undefined {
  return GIFT_CATALOG.find((gift) => gift.id === giftId);
}
