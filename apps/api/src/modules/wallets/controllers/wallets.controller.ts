import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import type { HttpResponseContext, HttpRouterContext } from "@zudojs/http";

import { requireAuthenticatedPrincipal } from "../../../middlewares/authenticate.middleware.js";
import { findViewerLocale } from "../../../middlewares/viewerLocale.middleware.js";
import type { Page } from "../../../types/pagination.type.js";
import { empty, json, readJsonBody, validationFailed } from "../../../utils/http.util.js";
import { buildPageRequest, mapPageItems } from "../../../utils/pagination.util.js";
import { AddPayoutAccountCommand } from "../commands/addPayoutAccount/addPayoutAccount.command.js";
import { ProcessWithdrawalCommand } from "../commands/processWithdrawal/processWithdrawal.command.js";
import { RemovePayoutAccountCommand } from "../commands/removePayoutAccount/removePayoutAccount.command.js";
import { RequestWithdrawalCommand } from "../commands/requestWithdrawal/requestWithdrawal.command.js";
import { StartWalletTopUpCommand } from "../commands/startWalletTopUp/startWalletTopUp.command.js";
import { VerifyWalletTopUpCommand } from "../commands/verifyWalletTopUp/verifyWalletTopUp.command.js";
import { convertLedgerEntryToDto, convertPayoutAccountToDto, convertWalletTopUpToDto, convertWithdrawalToDto } from "../dtos/wallets.dto.js";
import type { LedgerEntryRecord, PayoutAccountRecord, WalletScopeInput, WalletTopUpRecord, WithdrawalRecord } from "../models/wallets.model.js";
import { GetWalletQuery } from "../queries/getWallet/getWallet.query.js";
import { ListPayoutAccountsQuery } from "../queries/listPayoutAccounts/listPayoutAccounts.query.js";
import { ListWalletTransactionsQuery } from "../queries/listWalletTransactions/listWalletTransactions.query.js";
import { ListWithdrawalsQuery } from "../queries/listWithdrawals/listWithdrawals.query.js";
import type { BankDirectory } from "../services/bankDirectory.service.js";
import type { StartedWalletTopUp } from "../services/walletTopUps.service.js";
import type { PersonalWalletSummary, StoreWalletSummary } from "../services/wallets.service.js";
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
} from "../validators/wallets.validator.js";

type ScopeQuery = { readonly scope?: "store" | "user" | undefined; readonly storeId?: string | undefined; readonly currency?: WalletScopeInput["currency"] | undefined };

function buildWalletScope(ctx: HttpRouterContext, query: ScopeQuery): WalletScopeInput {
  return { scope: query.scope ?? "store", storeId: query.storeId, currency: query.currency ?? findViewerLocale(ctx).currency };
}

export class WalletsController {
  public constructor(private readonly commands: CommandBus, private readonly queries: QueryBus, private readonly bankDirectory: BankDirectory) {}

  public readonly listBanks = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const query = BanksQuerySchema.safeParse(ctx.query);
    if (!query.success) return validationFailed(query.issues);
    const countryCode = query.data.country?.toUpperCase() ?? findViewerLocale(ctx).countryCode ?? "NG";
    return json(200, await this.bankDirectory.listBanksForCountry(countryCode));
  };

  public readonly getWallet = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const scope = WalletScopeQuerySchema.safeParse(ctx.query);
    if (!scope.success) return validationFailed(scope.issues);
    const query = new GetWalletQuery(requireAuthenticatedPrincipal(ctx), buildWalletScope(ctx, scope.data));
    return json(200, await this.queries.execute<GetWalletQuery, StoreWalletSummary | PersonalWalletSummary>(query));
  };

  public readonly listTransactions = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const page = WalletPageQuerySchema.safeParse(ctx.query);
    if (!page.success) return validationFailed(page.issues);
    const query = new ListWalletTransactionsQuery(requireAuthenticatedPrincipal(ctx), buildWalletScope(ctx, page.data), buildPageRequest(page.data));
    return json(200, mapPageItems(await this.queries.execute<ListWalletTransactionsQuery, Page<LedgerEntryRecord>>(query), convertLedgerEntryToDto));
  };

  public readonly listPayoutAccounts = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const scope = WalletScopeQuerySchema.safeParse(ctx.query);
    if (!scope.success) return validationFailed(scope.issues);
    const query = new ListPayoutAccountsQuery(requireAuthenticatedPrincipal(ctx), buildWalletScope(ctx, scope.data));
    return json(200, (await this.queries.execute<ListPayoutAccountsQuery, readonly PayoutAccountRecord[]>(query)).map(convertPayoutAccountToDto));
  };

  public readonly addPayoutAccount = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const scope = WalletScopeQuerySchema.safeParse(ctx.query);
    if (!scope.success) return validationFailed(scope.issues);
    const body = AddPayoutAccountBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new AddPayoutAccountCommand(requireAuthenticatedPrincipal(ctx), buildWalletScope(ctx, scope.data), body.data);
    return json(201, convertPayoutAccountToDto(await this.commands.execute<AddPayoutAccountCommand, PayoutAccountRecord>(command)));
  };

  public readonly removePayoutAccount = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = PayoutAccountParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const scope = WalletScopeQuerySchema.safeParse(ctx.query);
    if (!scope.success) return validationFailed(scope.issues);
    await this.commands.execute<RemovePayoutAccountCommand, void>(new RemovePayoutAccountCommand(requireAuthenticatedPrincipal(ctx), buildWalletScope(ctx, scope.data), params.data.id));
    return empty(204);
  };

  public readonly listWithdrawals = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const page = WalletPageQuerySchema.safeParse(ctx.query);
    if (!page.success) return validationFailed(page.issues);
    const query = new ListWithdrawalsQuery(requireAuthenticatedPrincipal(ctx), buildWalletScope(ctx, page.data), buildPageRequest(page.data));
    return json(200, mapPageItems(await this.queries.execute<ListWithdrawalsQuery, Page<WithdrawalRecord>>(query), convertWithdrawalToDto));
  };

  public readonly requestWithdrawal = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const scope = WalletScopeQuerySchema.safeParse(ctx.query);
    if (!scope.success) return validationFailed(scope.issues);
    const body = RequestWithdrawalBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new RequestWithdrawalCommand(requireAuthenticatedPrincipal(ctx), buildWalletScope(ctx, scope.data), body.data.amount, body.data.payoutAccountId);
    return json(201, convertWithdrawalToDto(await this.commands.execute<RequestWithdrawalCommand, WithdrawalRecord>(command)));
  };

  public readonly startTopUp = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const body = StartWalletTopUpBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const { amount, currency, provider, returnTo } = body.data;
    const command = new StartWalletTopUpCommand(requireAuthenticatedPrincipal(ctx), amount, currency, provider, returnTo);
    const started = await this.commands.execute<StartWalletTopUpCommand, StartedWalletTopUp>(command);
    return json(201, { authorizationUrl: started.authorizationUrl, reference: started.topUp.reference, callbackUrl: started.callbackUrl, topUp: convertWalletTopUpToDto(started.topUp) });
  };

  public readonly verifyTopUp = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = TopUpParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const command = new VerifyWalletTopUpCommand(requireAuthenticatedPrincipal(ctx), params.data.reference);
    return json(200, convertWalletTopUpToDto(await this.commands.execute<VerifyWalletTopUpCommand, WalletTopUpRecord>(command)));
  };

  public readonly processWithdrawal = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = WithdrawalParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const command = new ProcessWithdrawalCommand(requireAuthenticatedPrincipal(ctx), params.data.id);
    return json(200, convertWithdrawalToDto(await this.commands.execute<ProcessWithdrawalCommand, WithdrawalRecord>(command)));
  };
}
