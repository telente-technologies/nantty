import { ApiError } from "@/errors/api.error";
import type { LiveGift, SendLiveGiftInput, SentLiveGiftReceipt } from "@/types";

import { spendMockCoinsOrThrow } from "./coins.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";

const buildMockGift = (id: string, name: string, emoji: string, priceCoins: number): LiveGift => ({ id, name, emoji, imageUrl: null, priceCoins });

const giftPriceInCoinsById: Record<string, number> = {
  gift_rose: 1,
  gift_jollof: 5,
  gift_heart: 10,
  gift_crown: 50,
  gift_rocket: 100,
  gift_lion: 500,
};

const giftCatalog: LiveGift[] = [
  buildMockGift("gift_rose", "Rose", "🌹", giftPriceInCoinsById.gift_rose!),
  buildMockGift("gift_jollof", "Jollof", "🍛", giftPriceInCoinsById.gift_jollof!),
  buildMockGift("gift_heart", "Big Love", "💖", giftPriceInCoinsById.gift_heart!),
  buildMockGift("gift_crown", "Crown", "👑", giftPriceInCoinsById.gift_crown!),
  buildMockGift("gift_rocket", "Rocket", "🚀", giftPriceInCoinsById.gift_rocket!),
  buildMockGift("gift_lion", "Lion King", "🦁", giftPriceInCoinsById.gift_lion!),
];

export const giftsMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/gifts", () => giftCatalog),
  createMockRoute("POST", "/api/v1/lives/:liveId/gifts", ({ body }): SentLiveGiftReceipt => {
    const { giftId, quantity } = body as SendLiveGiftInput;
    const unitPriceCoins = giftPriceInCoinsById[giftId];
    if (unitPriceCoins === undefined) throw new ApiError(404, "Gift not found");
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) throw new ApiError(400, "Choose between 1 and 99 gifts");
    const coinBalance = spendMockCoinsOrThrow(unitPriceCoins * quantity);
    return { giftId, quantity, coinBalance };
  }),
];
