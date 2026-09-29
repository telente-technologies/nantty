import type { CoinPackInput } from "../models/coins.model.js";

export const DEFAULT_COIN_PACKS: readonly CoinPackInput[] = [
  {
    id: "coins-70", name: "70 coins", coins: 70, bonusCoins: 0, storeProductId: "zudomart.coins.70", active: true, sortOrder: 1,
    prices: { NGN: 150_000, GHS: 1_200, KES: 13_000, ZAR: 1_800, GBP: 79, EUR: 89, USD: 99 },
  },
  {
    id: "coins-350", name: "350 coins", coins: 350, bonusCoins: 0, storeProductId: "zudomart.coins.350", active: true, sortOrder: 2,
    prices: { NGN: 750_000, GHS: 6_000, KES: 65_000, ZAR: 9_000, GBP: 399, EUR: 449, USD: 499 },
  },
  {
    id: "coins-700", name: "700 coins", coins: 700, bonusCoins: 35, storeProductId: "zudomart.coins.700", active: true, sortOrder: 3,
    prices: { NGN: 1_500_000, GHS: 12_000, KES: 130_000, ZAR: 18_000, GBP: 799, EUR: 899, USD: 999 },
  },
  {
    id: "coins-1400", name: "1,400 coins", coins: 1_400, bonusCoins: 140, storeProductId: "zudomart.coins.1400", active: true, sortOrder: 4,
    prices: { NGN: 3_000_000, GHS: 24_000, KES: 260_000, ZAR: 36_000, GBP: 1_599, EUR: 1_799, USD: 1_999 },
  },
  {
    id: "coins-3500", name: "3,500 coins", coins: 3_500, bonusCoins: 525, storeProductId: "zudomart.coins.3500", active: true, sortOrder: 5,
    prices: { NGN: 7_500_000, GHS: 60_000, KES: 650_000, ZAR: 90_000, GBP: 3_999, EUR: 4_499, USD: 4_999 },
  },
];
