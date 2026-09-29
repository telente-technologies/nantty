export interface GiftDefinition {
  readonly id: string;
  readonly name: string;
  readonly emoji: string;
  readonly priceCoins: number;
}

export const GIFT_CATALOG: readonly GiftDefinition[] = [
  { id: "rose", name: "Rose", emoji: "🌹", priceCoins: 1 },
  { id: "heart", name: "Heart", emoji: "💖", priceCoins: 5 },
  { id: "fire", name: "Fire", emoji: "🔥", priceCoins: 10 },
  { id: "crown", name: "Crown", emoji: "👑", priceCoins: 50 },
  { id: "rocket", name: "Rocket", emoji: "🚀", priceCoins: 200 },
];

export function findGiftDefinition(giftId: string): GiftDefinition | undefined {
  return GIFT_CATALOG.find((gift) => gift.id === giftId);
}
