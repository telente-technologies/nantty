import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import type { HttpResponseContext, HttpRouterContext } from "@zudojs/http";

import type { CoinPurchasePlatform } from "../../../configs/monetization.config.js";
import { IDEMPOTENCY_KEY_HEADER } from "../../../constants/security.constant.js";
import type { CurrencyCode } from "../../../enums/currency.enum.js";
import { requireAuthenticatedPrincipal } from "../../../middlewares/authenticate.middleware.js";
import { findViewerLocale } from "../../../middlewares/viewerLocale.middleware.js";
import type { Page } from "../../../types/pagination.type.js";
import { json, readJsonBody, validationFailed } from "../../../utils/http.util.js";
import { buildPageRequest, mapPageItems } from "../../../utils/pagination.util.js";
import type { LedgerEntryRecord } from "../../wallets/models/wallets.model.js";
import { RedeemStoreReceiptCommand } from "../commands/redeemStoreReceipt/redeemStoreReceipt.command.js";
import { SaveCoinPackCommand } from "../commands/saveCoinPack/saveCoinPack.command.js";
import { StartCoinPurchaseCommand } from "../commands/startCoinPurchase/startCoinPurchase.command.js";
import { TransferCoinsCommand } from "../commands/transferCoins/transferCoins.command.js";
import { VerifyCoinPurchaseCommand } from "../commands/verifyCoinPurchase/verifyCoinPurchase.command.js";
import { convertCoinEntryToDto, convertCoinPurchaseToDto, type CoinPackDto } from "../dtos/coins.dto.js";
import { GetCoinBalanceQuery } from "../queries/getCoinBalance/getCoinBalance.query.js";
import { ListCoinPacksQuery } from "../queries/listCoinPacks/listCoinPacks.query.js";
import { ListCoinTransactionsQuery } from "../queries/listCoinTransactions/listCoinTransactions.query.js";
import { QuoteCoinTransferQuery } from "../queries/quoteCoinTransfer/quoteCoinTransfer.query.js";
import type { CoinTransferPosted } from "../services/coinLedger.service.js";
import type { StartedCoinPurchase, VerifiedCoinPurchase } from "../services/coinPurchases.service.js";
import type { CoinBalanceView, CoinTransferQuote } from "../services/coinWallet.service.js";
import {
  CoinPackParamsSchema,
  CoinPageQuerySchema,
  CoinPurchaseParamsSchema,
  CoinTransferBodySchema,
  CoinTransferQuoteQuerySchema,
  SaveCoinPackBodySchema,
  StartCoinPurchaseBodySchema,
  StoreReceiptBodySchema,
} from "../validators/coins.validator.js";

const PLATFORM_HEADER = "x-client-platform";

function readClientPlatform(ctx: HttpRouterContext, fromBody: CoinPurchasePlatform | undefined): CoinPurchasePlatform {
  const header = ctx.request.getHeader(PLATFORM_HEADER)?.trim().toLowerCase();
  const query = typeof ctx.query["platform"] === "string" ? ctx.query["platform"].toLowerCase() : undefined;
  const candidate = fromBody ?? query ?? header;
  return candidate === "ios" || candidate === "android" ? candidate : "web";
}

function presentVerifiedPurchase(result: VerifiedCoinPurchase) {
  return { status: result.purchase.status, coins: result.purchase.coins, balance: result.balance, purchase: convertCoinPurchaseToDto(result.purchase) };
}

export class CoinsController {
  public constructor(private readonly commands: CommandBus, private readonly queries: QueryBus) {}

  public readonly balance = async (ctx: HttpRouterContext): Promise<HttpResponseContext> =>
    json(200, await this.queries.execute<GetCoinBalanceQuery, CoinBalanceView>(new GetCoinBalanceQuery(requireAuthenticatedPrincipal(ctx).userId)));

  public readonly packs = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const data = await this.queries.execute<ListCoinPacksQuery, readonly CoinPackDto[]>(new ListCoinPacksQuery(findViewerLocale(ctx).currency, false));
    return json(200, { data });
  };

  public readonly startPurchase = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const body = StartCoinPurchaseBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const packId = body.data.packId ?? body.data.packageId;
    if (packId === undefined) return json(400, { message: "packId is required.", code: "VALIDATION_FAILED" });
    const locale = findViewerLocale(ctx);
    const command = new StartCoinPurchaseCommand({
      userId: requireAuthenticatedPrincipal(ctx).userId,
      packId,
      provider: body.data.provider ?? "paystack",
      platform: readClientPlatform(ctx, body.data.platform),
      countryCode: locale.countryCode,
      displayCurrency: locale.currency,
      returnTo: body.data.returnTo,
    });
    const started = await this.commands.execute<StartCoinPurchaseCommand, StartedCoinPurchase>(command);
    return json(201, { ...started, purchase: started.purchase === null ? null : convertCoinPurchaseToDto(started.purchase) });
  };

  public readonly verifyPurchase = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = CoinPurchaseParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const command = new VerifyCoinPurchaseCommand(requireAuthenticatedPrincipal(ctx).userId, params.data.reference);
    return json(200, presentVerifiedPurchase(await this.commands.execute<VerifyCoinPurchaseCommand, VerifiedCoinPurchase>(command)));
  };

  public readonly redeemStoreReceipt = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const body = StoreReceiptBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new RedeemStoreReceiptCommand({ ...body.data, userId: requireAuthenticatedPrincipal(ctx).userId, countryCode: findViewerLocale(ctx).countryCode });
    return json(201, presentVerifiedPurchase(await this.commands.execute<RedeemStoreReceiptCommand, VerifiedCoinPurchase>(command)));
  };

  public readonly transactions = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const query = CoinPageQuerySchema.safeParse(ctx.query);
    if (!query.success) return validationFailed(query.issues);
    const listQuery = new ListCoinTransactionsQuery(requireAuthenticatedPrincipal(ctx).userId, buildPageRequest(query.data));
    return json(200, mapPageItems(await this.queries.execute<ListCoinTransactionsQuery, Page<LedgerEntryRecord>>(listQuery), convertCoinEntryToDto));
  };

  public readonly quoteTransfer = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const query = CoinTransferQuoteQuerySchema.safeParse(ctx.query);
    if (!query.success) return validationFailed(query.issues);
    return json(200, await this.queries.execute<QuoteCoinTransferQuery, CoinTransferQuote>(new QuoteCoinTransferQuery(query.data.coins)));
  };

  public readonly transfer = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const body = CoinTransferBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new TransferCoinsCommand({
      senderUserId: requireAuthenticatedPrincipal(ctx).userId, recipientUserId: body.data.recipientUserId, coins: body.data.coins, note: body.data.note,
      idempotencyKey: ctx.request.getHeader(IDEMPOTENCY_KEY_HEADER)?.trim() ?? "",
    });
    const posted = await this.commands.execute<TransferCoinsCommand, CoinTransferPosted>(command);
    return json(201, { transferId: posted.transactionId, coins: posted.coins, feeCoins: posted.feeCoins, netCoins: posted.netCoins, balance: posted.balance });
  };

  public readonly listPacksForAdmin = async (): Promise<HttpResponseContext> => {
    const data = await this.queries.execute<ListCoinPacksQuery, readonly CoinPackDto[]>(new ListCoinPacksQuery("USD" as CurrencyCode, true));
    return json(200, { data });
  };

  public readonly savePack = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = CoinPackParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const body = SaveCoinPackBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const { prices, storeProductId, ...rest } = body.data;
    const pack = { ...rest, id: params.data.id, storeProductId: storeProductId ?? null, prices: Object.fromEntries(prices.map((price) => [price.currency, price.amountMinor])) };
    return json(200, await this.commands.execute<SaveCoinPackCommand, CoinPackDto>(new SaveCoinPackCommand(requireAuthenticatedPrincipal(ctx).userId, pack)));
  };
}
