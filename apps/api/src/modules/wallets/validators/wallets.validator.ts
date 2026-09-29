import { schema } from "@zudojs/schema";

import { MAX_PAGE_SIZE } from "../../../utils/pagination.util.js";

export const WalletScopeQuerySchema = schema.object({ storeId: schema.string().uuid().optional() });

export const PayoutAccountParamsSchema = schema.object({ id: schema.string().uuid() });

export const BanksQuerySchema = schema.object({ country: schema.string().regex(/^[A-Za-z]{2}$/).optional() });

export const WithdrawalParamsSchema = schema.object({ id: schema.string().uuid() });

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

export const WalletPageQuerySchema = schema.object({
  storeId: schema.string().uuid().optional(),
  limit: schema.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
  cursor: schema.string().uuid().optional(),
});
