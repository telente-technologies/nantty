import { ApiError } from "@/errors/api.error";
import type { CoinPackage, SendTipInput } from "@/types";

import { convertUsdCentsToViewerCurrency } from "./locale.mock";
import { mockProviderWalletState } from "./providerWallet.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";

const COIN_TRANSFER_FEE_PERCENT = 25;
const MOCK_COIN_RETURN_PATH = "/coins/return";

const mockCoinWallet = { balance: 250 };

export const readMockCoinBalance = () => mockCoinWallet.balance;

export function spendMockCoinsOrThrow(coins: number) {
  if (coins > mockCoinWallet.balance) throw new ApiError(402, "You don't have enough coins. Buy more coins and try again.", "INSUFFICIENT_COINS");
  mockCoinWallet.balance -= coins;
  return mockCoinWallet.balance;
}

const coinPackageSeeds = [
  { id: "coins_100", coins: 100, usdCents: 99 },
  { id: "coins_550", coins: 500, bonusCoins: 50, usdCents: 499 },
  { id: "coins_1200", coins: 1_000, bonusCoins: 200, usdCents: 999 },
  { id: "coins_6500", coins: 5_000, bonusCoins: 1_500, usdCents: 4_999 },
];

const buildCoinPackages = (): CoinPackage[] =>
  coinPackageSeeds.map(({ usdCents, ...coinPackage }) => ({ ...coinPackage, price: convertUsdCentsToViewerCurrency(usdCents) }));

const pendingPurchasesByReference = new Map<string, { coins: number; credited: boolean }>();

const quoteCoinTransfer = (coins: number) => {
  const feeCoins = Math.ceil((coins * COIN_TRANSFER_FEE_PERCENT) / 100);
  return { feeCoins, netCoins: coins - feeCoins, feePercent: COIN_TRANSFER_FEE_PERCENT };
};

const requirePositiveWholeCoins = (coins: unknown) => {
  if (typeof coins !== "number" || !Number.isInteger(coins) || coins < 1) throw new ApiError(400, "Enter a whole number of coins");
  return coins;
};

export const coinsMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/coins/balance", () => ({ coins: mockCoinWallet.balance })),
  createMockRoute("GET", "/api/v1/coins/packages", () => buildCoinPackages()),
  createMockRoute("POST", "/api/v1/coins/purchases", ({ body }) => {
    const { packageId } = body as { packageId: string };
    const seed = coinPackageSeeds.find((coinPackage) => coinPackage.id === packageId);
    if (!seed) throw new ApiError(404, "Coin package not found");
    const reference = `cp_${Date.now().toString(36)}`;
    pendingPurchasesByReference.set(reference, { coins: seed.coins + (seed.bonusCoins ?? 0), credited: false });
    const returnUrl = `${MOCK_COIN_RETURN_PATH}?reference=${reference}`;
    const checkoutUrl = `/pay/demo?reference=${reference}&next=${encodeURIComponent(returnUrl)}`;
    return { reference, provider: "flutterwave", purchaseChannel: "web_checkout", accessCode: "", checkoutUrl, authorizationUrl: checkoutUrl };
  }),
  createMockRoute("POST", "/api/v1/coins/purchases/:reference/verify", ({ params }) => {
    const purchase = pendingPurchasesByReference.get(params.reference!);
    if (!purchase) throw new ApiError(404, "Purchase not found");
    if (mockProviderWalletState.declinedReferences.has(params.reference!)) return { status: "failed", coins: purchase.coins };
    if (!purchase.credited) {
      purchase.credited = true;
      mockCoinWallet.balance += purchase.coins;
    }
    return { status: "succeeded", coins: purchase.coins };
  }),
  createMockRoute("GET", "/api/v1/coins/transfers/quote", ({ query }) => quoteCoinTransfer(Number(query.get("coins") ?? 0))),
  createMockRoute("POST", "/api/v1/coins/transfers", ({ body }) => {
    const { recipientUserId, coins } = body as { recipientUserId: string; coins: number };
    if (!recipientUserId) throw new ApiError(400, "Choose who to send coins to");
    const quote = quoteCoinTransfer(requirePositiveWholeCoins(coins));
    const balance = spendMockCoinsOrThrow(coins);
    return { transferId: `ct_${Date.now().toString(36)}`, feeCoins: quote.feeCoins, netCoins: quote.netCoins, balance };
  }),
  createMockRoute("POST", "/api/v1/tips", ({ body }) => {
    const input = body as SendTipInput;
    const coins = requirePositiveWholeCoins(input.coins);
    const balance = spendMockCoinsOrThrow(coins);
    return { tipId: `tip_${Date.now().toString(36)}`, coins, balance };
  }),
];
