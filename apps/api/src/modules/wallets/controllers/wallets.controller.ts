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
import { convertLedgerEntryToDto, convertPayoutAccountToDto, convertWithdrawalToDto } from "../dtos/wallets.dto.js";
import type { LedgerEntryRecord, PayoutAccountRecord, WithdrawalRecord } from "../models/wallets.model.js";
import { GetWalletQuery } from "../queries/getWallet/getWallet.query.js";
import { ListPayoutAccountsQuery } from "../queries/listPayoutAccounts/listPayoutAccounts.query.js";
import { ListWalletTransactionsQuery } from "../queries/listWalletTransactions/listWalletTransactions.query.js";
import { ListWithdrawalsQuery } from "../queries/listWithdrawals/listWithdrawals.query.js";
import type { BankDirectory } from "../services/bankDirectory.service.js";
import type { StoreWalletSummary } from "../services/wallets.service.js";
import {
  AddPayoutAccountBodySchema,
  PayoutAccountParamsSchema,
  RequestWithdrawalBodySchema,
  BanksQuerySchema,
  WalletPageQuerySchema,
  WalletScopeQuerySchema,
  WithdrawalParamsSchema,
} from "../validators/wallets.validator.js";

export class WalletsController {
  public constructor(
    private readonly commands: CommandBus,
    private readonly queries: QueryBus,
    private readonly bankDirectory: BankDirectory,
  ) {}

  public readonly listBanks = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const query = BanksQuerySchema.safeParse(ctx.query);
    if (!query.success) return validationFailed(query.issues);
    const countryCode = query.data.country?.toUpperCase() ?? findViewerLocale(ctx).countryCode ?? "NG";
    return json(200, await this.bankDirectory.listBanksForCountry(countryCode));
  };

  public readonly getWallet = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const scope = WalletScopeQuerySchema.safeParse(ctx.query);
    if (!scope.success) return validationFailed(scope.issues);
    return json(200, await this.queries.execute<GetWalletQuery, StoreWalletSummary>(new GetWalletQuery(requireAuthenticatedPrincipal(ctx), scope.data.storeId)));
  };

  public readonly listTransactions = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const page = WalletPageQuerySchema.safeParse(ctx.query);
    if (!page.success) return validationFailed(page.issues);
    const query = new ListWalletTransactionsQuery(requireAuthenticatedPrincipal(ctx), page.data.storeId, buildPageRequest(page.data));
    return json(200, mapPageItems(await this.queries.execute<ListWalletTransactionsQuery, Page<LedgerEntryRecord>>(query), convertLedgerEntryToDto));
  };

  public readonly listPayoutAccounts = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const scope = WalletScopeQuerySchema.safeParse(ctx.query);
    if (!scope.success) return validationFailed(scope.issues);
    const accounts = await this.queries.execute<ListPayoutAccountsQuery, readonly PayoutAccountRecord[]>(new ListPayoutAccountsQuery(requireAuthenticatedPrincipal(ctx), scope.data.storeId));
    return json(200, accounts.map(convertPayoutAccountToDto));
  };

  public readonly addPayoutAccount = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const scope = WalletScopeQuerySchema.safeParse(ctx.query);
    if (!scope.success) return validationFailed(scope.issues);
    const body = AddPayoutAccountBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new AddPayoutAccountCommand(requireAuthenticatedPrincipal(ctx), scope.data.storeId, body.data);
    return json(201, convertPayoutAccountToDto(await this.commands.execute<AddPayoutAccountCommand, PayoutAccountRecord>(command)));
  };

  public readonly removePayoutAccount = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = PayoutAccountParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const scope = WalletScopeQuerySchema.safeParse(ctx.query);
    if (!scope.success) return validationFailed(scope.issues);
    const command = new RemovePayoutAccountCommand(requireAuthenticatedPrincipal(ctx), scope.data.storeId, params.data.id);
    await this.commands.execute<RemovePayoutAccountCommand, void>(command);
    return empty(204);
  };

  public readonly listWithdrawals = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const page = WalletPageQuerySchema.safeParse(ctx.query);
    if (!page.success) return validationFailed(page.issues);
    const query = new ListWithdrawalsQuery(requireAuthenticatedPrincipal(ctx), page.data.storeId, buildPageRequest(page.data));
    return json(200, mapPageItems(await this.queries.execute<ListWithdrawalsQuery, Page<WithdrawalRecord>>(query), convertWithdrawalToDto));
  };

  public readonly requestWithdrawal = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const scope = WalletScopeQuerySchema.safeParse(ctx.query);
    if (!scope.success) return validationFailed(scope.issues);
    const body = RequestWithdrawalBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new RequestWithdrawalCommand(requireAuthenticatedPrincipal(ctx), scope.data.storeId, body.data.amount, body.data.payoutAccountId);
    return json(201, convertWithdrawalToDto(await this.commands.execute<RequestWithdrawalCommand, WithdrawalRecord>(command)));
  };

  public readonly processWithdrawal = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = WithdrawalParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const command = new ProcessWithdrawalCommand(requireAuthenticatedPrincipal(ctx), params.data.id);
    return json(200, convertWithdrawalToDto(await this.commands.execute<ProcessWithdrawalCommand, WithdrawalRecord>(command)));
  };
}
