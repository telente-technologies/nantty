import type { CurrencyCode } from "../../../enums/currency.enum.js";
import type { LedgerAccountSpecification } from "../models/wallets.model.js";

function platformAccount(key: string, kind: LedgerAccountSpecification["kind"], allowNegative: boolean): LedgerAccountSpecification {
  return { key, ownerType: "platform", ownerId: null, kind, allowNegative };
}

export const MonetizationLedgerAccounts = {
  userCoins: (userId: string): LedgerAccountSpecification => ({
    key: `liability:user-coins:${userId}:COIN`, ownerType: "user_coins", ownerId: userId, kind: "liability", allowNegative: false,
  }),
  creatorEarnedCoins: (userId: string): LedgerAccountSpecification => ({
    key: `liability:creator-coins:${userId}:COIN`, ownerType: "creator_coins", ownerId: userId, kind: "liability", allowNegative: false,
  }),
  loyaltyPoints: (userId: string): LedgerAccountSpecification => ({
    key: `liability:loyalty-points:${userId}:POINT`, ownerType: "user_points", ownerId: userId, kind: "liability", allowNegative: false,
  }),
  coinsInCirculation: (): LedgerAccountSpecification => platformAccount("asset:coins-in-circulation:COIN", "asset", true),
  platformCoinFees: (): LedgerAccountSpecification => platformAccount("revenue:coin-fees:COIN", "revenue", false),
  loyaltyPointsIssued: (): LedgerAccountSpecification => platformAccount("asset:loyalty-points-issued:POINT", "asset", true),
  coinSalesRevenue: (currency: CurrencyCode): LedgerAccountSpecification => platformAccount(`revenue:coin-sales:${currency}`, "revenue", false),
  storeInAppPurchaseClearing: (store: string, currency: CurrencyCode): LedgerAccountSpecification =>
    platformAccount(`asset:iap-clearing:${store}:${currency}`, "asset", true),
  creatorCoinPayoutExpense: (currency: CurrencyCode): LedgerAccountSpecification => platformAccount(`asset:creator-coin-payouts:${currency}`, "asset", true),
  adsRevenue: (currency: CurrencyCode): LedgerAccountSpecification => platformAccount(`revenue:ads:${currency}`, "revenue", false),
  creatorSubscriptionRevenue: (currency: CurrencyCode): LedgerAccountSpecification => platformAccount(`revenue:creator-subscriptions:${currency}`, "revenue", false),
  loyaltyRedemptionExpense: (currency: CurrencyCode): LedgerAccountSpecification => platformAccount(`asset:loyalty-redemptions:${currency}`, "asset", true),
  cashbackExpense: (currency: CurrencyCode): LedgerAccountSpecification => platformAccount(`asset:cashback:${currency}`, "asset", true),
  referralRewardExpense: (currency: CurrencyCode): LedgerAccountSpecification => platformAccount(`asset:referral-rewards:${currency}`, "asset", true),
  payoutTransferFees: (currency: CurrencyCode): LedgerAccountSpecification => platformAccount(`liability:payout-transfer-fees:${currency}`, "liability", false),
};
