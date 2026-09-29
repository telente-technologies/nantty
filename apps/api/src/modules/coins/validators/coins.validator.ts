import { schema } from "@zudojs/schema";

import { SUPPORTED_CURRENCY_CODES } from "../../../enums/currency.enum.js";
import { MAX_PAGE_SIZE } from "../../../utils/pagination.util.js";

export const CoinPlatformQuerySchema = schema.object({ platform: schema.enum(["ios", "android", "web"]).optional() });

export const StartCoinPurchaseBodySchema = schema.object({
  packId: schema.string().min(1).max(60).optional(),
  packageId: schema.string().min(1).max(60).optional(),
  provider: schema.enum(["paystack", "flutterwave"]).optional(),
  platform: schema.enum(["ios", "android", "web"]).optional(),
  returnTo: schema.string().min(3).max(300).optional(),
});

export const CoinPurchaseParamsSchema = schema.object({ reference: schema.string().min(6).max(80).regex(/^[A-Za-z0-9_-]+$/) });

export const StoreReceiptBodySchema = schema.object({
  platform: schema.enum(["ios", "android"]),
  productId: schema.string().min(1).max(120),
  receipt: schema.string().min(1).max(20_000),
  transactionId: schema.string().min(1).max(200).optional(),
});

export const CoinTransferBodySchema = schema.object({
  recipientUserId: schema.string().uuid(),
  coins: schema.number().int().min(1).max(100_000_000),
  note: schema.string().max(140).optional(),
});

export const CoinTransferQuoteQuerySchema = schema.object({ coins: schema.coerce.number().int().min(1).max(100_000_000) });

export const CoinPageQuerySchema = schema.object({
  limit: schema.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
  cursor: schema.string().uuid().optional(),
});

export const CoinPackParamsSchema = schema.object({ id: schema.string().min(2).max(60).regex(/^[a-z0-9-]+$/) });

export const SaveCoinPackBodySchema = schema.object({
  name: schema.string().min(1).max(80),
  coins: schema.number().int().min(1).max(10_000_000),
  bonusCoins: schema.number().int().min(0).max(10_000_000).default(0),
  prices: schema.array(schema.object({ currency: schema.enum(SUPPORTED_CURRENCY_CODES), amountMinor: schema.number().int().min(1).max(1_000_000_000) })).min(1).max(10),
  storeProductId: schema.string().min(1).max(120).optional(),
  active: schema.boolean().default(true),
  sortOrder: schema.number().int().min(0).max(1000).default(0),
});
