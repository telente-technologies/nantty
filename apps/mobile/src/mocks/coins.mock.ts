import { ApiError } from "@/errors/api.error";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";
import { useLocaleStore } from "@/store/locale.store";
import type { CoinActivityEntry, CoinConversionReceipt, CoinPackage, CurrencyCode, SendTipInput } from "@/types";

import { convertUsdCentsToViewerCurrency } from "./locale.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";

const COIN_TRANSFER_FEE_PERCENT = 25;
const MOCK_CHECKOUT_PAGE_URL = "https://nantty.com/pay/mock";

export const COIN_CASH_VALUE_MINOR: Record<CurrencyCode, number> = { NGN: 1_000, GHS: 10, KES: 100, ZAR: 15, GBP: 1, EUR: 1, USD: 1 };
const MINIMUM_PAYOUT_MINOR = 1_000;

const mockCoinWallet = { balance: 250, earned: 180 };

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
const mockCoinActivity: CoinActivityEntry[] = [
  { id: "le_1", transactionId: "lt_1", type: "credit", coins: 120, balanceAfter: 250, createdAt: daysAgo(2) },
  { id: "le_2", transactionId: "lt_2", type: "credit", coins: 60, balanceAfter: 130, createdAt: daysAgo(5) },
  { id: "le_3", transactionId: "lt_3", type: "debit", coins: 40, balanceAfter: 70, createdAt: daysAgo(9) },
  { id: "le_4", transactionId: "lt_4", type: "credit", coins: 110, balanceAfter: 110, createdAt: daysAgo(14) },
];

export const readMockCoinBalance = () => mockCoinWallet.balance;
export const readMockEarnedCoins = () => mockCoinWallet.earned;

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
  createMockRoute("GET", "/api/v1/coins/balance", () => ({ coins: mockCoinWallet.balance, earnedCoins: mockCoinWallet.earned })),
  createMockRoute("GET", "/api/v1/coins/transactions", () => ({ data: mockCoinActivity, nextCursor: null })),
  createMockRoute("POST", "/api/v1/creators/earnings/convert", ({ body }) => {
    const { coins } = body as { coins?: unknown };
    const amount = requirePositiveWholeCoins(coins);
    const currency = useLocaleStore.getState().currency;
    const cashMinor = amount * (COIN_CASH_VALUE_MINOR[currency] ?? 1);
    if (cashMinor < MINIMUM_PAYOUT_MINOR) {
      throw new ApiError(422, `Convert at least ${formatMoneyForDisplay({ amountMinor: MINIMUM_PAYOUT_MINOR, currency })}; ${amount} coins are worth ${formatMoneyForDisplay({ amountMinor: cashMinor, currency })}.`);
    }
    if (mockCoinWallet.earned < amount) throw new ApiError(422, "You do not have enough earned coins to convert.");
    mockCoinWallet.earned -= amount;
    mockCoinWallet.balance -= amount;
    mockCoinActivity.unshift({
      id: `le_${Date.now().toString(36)}`,
      transactionId: `lt_${Date.now().toString(36)}`,
      type: "debit",
      coins: amount,
      balanceAfter: mockCoinWallet.balance,
      createdAt: new Date().toISOString(),
    });
    const receipt: CoinConversionReceipt = {
      coins: amount,
      cash: { amountMinor: cashMinor, currency },
      earnedCoinsRemaining: mockCoinWallet.earned,
      minimumPayout: { amountMinor: MINIMUM_PAYOUT_MINOR, currency },
    };
    return receipt;
  }),
  createMockRoute("GET", "/api/v1/coins/packages", () => buildCoinPackages()),
  createMockRoute("POST", "/api/v1/coins/purchases", ({ body }) => {
    const { packageId } = body as { packageId: string };
    const seed = coinPackageSeeds.find((coinPackage) => coinPackage.id === packageId);
    if (!seed) throw new ApiError(404, "Coin package not found");
    const reference = `cp_${Date.now().toString(36)}`;
    pendingPurchasesByReference.set(reference, { coins: seed.coins + (seed.bonusCoins ?? 0), credited: false });
    return { reference, purchaseChannel: "web_checkout", authorizationUrl: `${MOCK_CHECKOUT_PAGE_URL}?reference=${reference}` };
  }),
  createMockRoute("POST", "/api/v1/coins/purchases/:reference/verify", ({ params }) => {
    const purchase = pendingPurchasesByReference.get(params.reference!);
    if (!purchase) throw new ApiError(404, "Purchase not found");
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
