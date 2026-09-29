import type { HttpRouter } from "@zudojs/http";

import type { WebKit } from "../../../loaders/web.loader.js";
import { describeRoute } from "../../../utils/openapi.util.js";
import type { WalletsController } from "../controllers/wallets.controller.js";
import {
  AddPayoutAccountBodySchema,
  BanksQuerySchema,
  PayoutAccountParamsSchema,
  RequestWithdrawalBodySchema,
  StartWalletTopUpBodySchema,
  TopUpParamsSchema,
  WalletPageQuerySchema,
  WalletScopeQuerySchema,
  WithdrawalParamsSchema,
  WithdrawalQuoteQuerySchema,
} from "../validators/wallets.validator.js";

const WALLET = "/api/v1/wallets/me";
const TAG = "wallets";

export function registerWalletsRoutes(router: HttpRouter, controller: WalletsController, web: WebKit): void {
  const { guard, requireIdempotencyKey } = web;
  const wallet = guard.requirePermission("wallet:use");
  const moneyMoving = guard.requirePermission("wallet:use", requireIdempotencyKey);
  router.get(WALLET, controller.getWallet, { ...wallet, ...describeRoute(TAG, "Get my store wallet (default) or personal wallet (scope=user)", { query: WalletScopeQuerySchema }) });
  router.get(`${WALLET}/transactions`, controller.listTransactions, { ...wallet, ...describeRoute(TAG, "List my wallet ledger entries", { query: WalletPageQuerySchema }) });
  router.get(`${WALLET}/payout-accounts`, controller.listPayoutAccounts, { ...wallet, ...describeRoute(TAG, "List my payout bank accounts", { query: WalletScopeQuerySchema }) });
  router.post(`${WALLET}/payout-accounts`, controller.addPayoutAccount, { ...wallet, ...describeRoute(TAG, "Add a payout bank account", { query: WalletScopeQuerySchema, body: AddPayoutAccountBodySchema }) });
  router.delete(`${WALLET}/payout-accounts/:id`, controller.removePayoutAccount, { ...wallet, ...describeRoute(TAG, "Remove a payout bank account", { params: PayoutAccountParamsSchema, query: WalletScopeQuerySchema }) });
  router.get(`${WALLET}/withdrawals`, controller.listWithdrawals, { ...wallet, ...describeRoute(TAG, "List my withdrawals", { query: WalletPageQuerySchema }) });
  router.get(`${WALLET}/withdrawals/quote`, controller.quoteWithdrawal, {
    ...wallet,
    ...describeRoute(TAG, "Preview a withdrawal: the provider transfer fee passed through and the amount you receive", { query: WithdrawalQuoteQuerySchema }),
  });
  router.post(`${WALLET}/withdrawals`, controller.requestWithdrawal, {
    ...moneyMoving,
    ...describeRoute(TAG, "Request a withdrawal (Idempotency-Key required)", { query: WalletScopeQuerySchema, body: RequestWithdrawalBodySchema }),
  });
  router.post(`${WALLET}/top-ups`, controller.startTopUp, {
    ...moneyMoving,
    ...describeRoute(TAG, "Start a personal wallet top-up; credited only after provider verification (Idempotency-Key required)", { body: StartWalletTopUpBodySchema }),
  });
  router.post(`${WALLET}/top-ups/:reference/verify`, controller.verifyTopUp, { ...wallet, ...describeRoute(TAG, "Verify a wallet top-up with the provider", { params: TopUpParamsSchema }) });
  router.get("/api/v1/banks", controller.listBanks, { ...guard.allowAnyone(), ...describeRoute(TAG, "List banks for payout accounts in a country", { query: BanksQuerySchema }) });
  router.post("/api/v1/admin/withdrawals/:id/process", controller.processWithdrawal, {
    ...guard.requirePermission("withdrawals:process", requireIdempotencyKey),
    ...describeRoute(TAG, "Pay out a withdrawal (Idempotency-Key required)", { params: WithdrawalParamsSchema }),
  });
}
