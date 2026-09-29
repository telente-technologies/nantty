import { schema } from "@zudojs/schema";

import { SUPPORTED_CURRENCY_CODES } from "../../../enums/currency.enum.js";
import { MAX_PAGE_SIZE } from "../../../utils/pagination.util.js";

const scopeFields = {
  scope: schema.enum(["store", "user"]).optional(),
  storeId: schema.string().uuid().optional(),
  currency: schema.enum(SUPPORTED_CURRENCY_CODES).optional(),
};

export const WalletScopeQuerySchema = schema.object(scopeFields);

export const PayoutAccountParamsSchema = schema.object({ id: schema.string().uuid() });

export const BanksQuerySchema = schema.object({ country: schema.string().regex(/^[A-Za-z]{2}$/).optional() });

export const WithdrawalParamsSchema = schema.object({ id: schema.string().uuid() });

export const TopUpParamsSchema = schema.object({ reference: schema.string().min(6).max(80).regex(/^[A-Za-z0-9_-]+$/) });

export const AddPayoutAccountBodySchema = schema.object({
  bankCode: schema.string().min(2).max(10).regex(/^[0-9A-Za-z]+$/),
  bankName: schema.string().min(2).max(80).optional(),
  accountNumber: schema.string().regex(/^\d{10}$/),
  accountName: schema.string().min(2).max(120),
  isDefault: schema.boolean().optional(),
});

export const RequestWithdrawalBodySchema = schema.object({
  amount: schema.number().int().min(100).max(1_000_000_000_000),
  payoutAccountId: schema.string().uuid(),
});

export const StartWalletTopUpBodySchema = schema.object({
  amount: schema.number().int().min(100).max(10_000_000_000),
  currency: schema.enum(SUPPORTED_CURRENCY_CODES),
  provider: schema.enum(["paystack", "flutterwave"]),
  returnTo: schema.string().min(3).max(300).optional(),
});

export const WalletPageQuerySchema = schema.object({
  ...scopeFields,
  limit: schema.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
  cursor: schema.string().uuid().optional(),
});
