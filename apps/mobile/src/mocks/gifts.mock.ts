import { ApiError } from "@/errors/api.error";
import type { LiveGift, Money, SendLiveGiftInput, SentLiveGiftReceipt } from "@/types";

import { convertUsdCentsToViewerCurrency } from "./locale.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";

const buildMockGift = (id: string, name: string, emoji: string, usdCents: number): LiveGift => ({
  id,
  name,
  emoji,
  imageUrl: null,
  get price() {
    return convertUsdCentsToViewerCurrency(usdCents);
  },
});

const giftPriceInUsdCentsById: Record<string, number> = {
  gift_rose: 10,
  gift_jollof: 50,
  gift_heart: 100,
  gift_crown: 500,
  gift_rocket: 1_000,
  gift_lion: 5_000,
};

const giftCatalog: LiveGift[] = [
  buildMockGift("gift_rose", "Rose", "🌹", giftPriceInUsdCentsById.gift_rose!),
  buildMockGift("gift_jollof", "Jollof", "🍛", giftPriceInUsdCentsById.gift_jollof!),
  buildMockGift("gift_heart", "Big Love", "💖", giftPriceInUsdCentsById.gift_heart!),
  buildMockGift("gift_crown", "Crown", "👑", giftPriceInUsdCentsById.gift_crown!),
  buildMockGift("gift_rocket", "Rocket", "🚀", giftPriceInUsdCentsById.gift_rocket!),
  buildMockGift("gift_lion", "Lion King", "🦁", giftPriceInUsdCentsById.gift_lion!),
];

let giftWalletSpentUsdCents = 0;
const GIFT_WALLET_STARTING_USD_CENTS = 2_000;

const giftWalletAvailable = (): Money => convertUsdCentsToViewerCurrency(GIFT_WALLET_STARTING_USD_CENTS - giftWalletSpentUsdCents);

export const giftsMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/gifts", () => giftCatalog),
  createMockRoute("POST", "/api/v1/lives/:liveId/gifts", ({ body }): SentLiveGiftReceipt => {
    const { giftId, quantity } = body as SendLiveGiftInput;
    const unitUsdCents = giftPriceInUsdCentsById[giftId];
    if (unitUsdCents === undefined) throw new ApiError(404, "Gift not found");
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) throw new ApiError(400, "Choose between 1 and 99 gifts");
    const totalUsdCents = unitUsdCents * quantity;
    if (giftWalletSpentUsdCents + totalUsdCents > GIFT_WALLET_STARTING_USD_CENTS) {
      throw new ApiError(402, "Your wallet balance is too low for this gift. Top up and try again.", "INSUFFICIENT_FUNDS");
    }
    giftWalletSpentUsdCents += totalUsdCents;
    return { giftId, quantity, walletAvailable: giftWalletAvailable() };
  }),
];
