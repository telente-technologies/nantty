import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import type { HttpResponseContext, HttpRouterContext } from "@zudojs/http";

import type { CurrencyConverter, MoneyConversion } from "../../../interfaces/currencyConverter.interface.js";
import { requireAuthenticatedPrincipal } from "../../../middlewares/authenticate.middleware.js";
import { findViewerLocale } from "../../../middlewares/viewerLocale.middleware.js";
import type { Page } from "../../../types/pagination.type.js";
import { empty, json, readJsonBody, validationFailed } from "../../../utils/http.util.js";
import { buildPageRequest } from "../../../utils/pagination.util.js";
import { keepNativeCurrency } from "../../products/dtos/price.dto.js";
import { AddStoreMemberCommand } from "../commands/addStoreMember/addStoreMember.command.js";
import { CreateStoreCommand } from "../commands/createStore/createStore.command.js";
import { FeatureStoreCommand } from "../commands/featureStore/featureStore.command.js";
import { RemoveStoreMemberCommand } from "../commands/removeStoreMember/removeStoreMember.command.js";
import { SuspendStoreCommand } from "../commands/suspendStore/suspendStore.command.js";
import { UpdateStoreCommand } from "../commands/updateStore/updateStore.command.js";
import { UNVERIFIED_STORE_BADGE, type VerificationBadge, type VerificationBadgeLookup } from "../../../interfaces/verificationBadge.interface.js";
import { convertStoreMemberToDto, convertStoreToDto, type StoreDto } from "../dtos/stores.dto.js";
import type { StoreMemberRecord, StoreRecord } from "../models/stores.model.js";
import type { StoreWithProductCount } from "../queries/getStore/getStore.handler.js";
import { GetStoreQuery } from "../queries/getStore/getStore.query.js";
import { ListMyStoresQuery } from "../queries/listMyStores/listMyStores.query.js";
import { ListStoreMembersQuery } from "../queries/listStoreMembers/listStoreMembers.query.js";
import { ListStoresQuery } from "../queries/listStores/listStores.query.js";
import {
  AddStoreMemberBodySchema,
  CreateStoreBodySchema,
  FeatureStoreBodySchema,
  ListStoresQuerySchema,
  StoreMemberParamsSchema,
  StoreParamsSchema,
  StoreSlugParamsSchema,
  StoreStatusBodySchema,
  UpdateStoreBodySchema,
} from "../validators/stores.validator.js";

export class StoresController {
  public constructor(
    private readonly commands: CommandBus,
    private readonly queries: QueryBus,
    private readonly currencyConverter: CurrencyConverter,
    private readonly verificationBadges?: VerificationBadgeLookup,
  ) {}

  public readonly list = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const query = ListStoresQuerySchema.safeParse(ctx.query);
    if (!query.success) return validationFailed(query.issues);
    const page = await this.queries.execute<ListStoresQuery, Page<StoreRecord>>(new ListStoresQuery(query.data.featured, buildPageRequest(query.data)));
    const convert = await this.prepareViewerConversion(ctx);
    return json(200, { data: await this.attachVerification(page.data.map((store) => convertStoreToDto(store, convert))), nextCursor: page.nextCursor });
  };

  public readonly listMine = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const stores = await this.queries.execute<ListMyStoresQuery, readonly StoreRecord[]>(new ListMyStoresQuery(requireAuthenticatedPrincipal(ctx)));
    return json(200, { data: await this.attachVerification(stores.map((store) => convertStoreToDto(store, keepNativeCurrency))) });
  };

  public readonly getById = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = StoreParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    return this.respondWithStore(ctx, new GetStoreQuery({ id: params.data.id }));
  };

  public readonly getBySlug = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = StoreSlugParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    return this.respondWithStore(ctx, new GetStoreQuery({ slug: params.data.slug }));
  };

  public readonly create = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const body = CreateStoreBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const currency = body.data.currency ?? findViewerLocale(ctx).currency;
    const command = new CreateStoreCommand(requireAuthenticatedPrincipal(ctx), body.data, currency);
    const store = await this.commands.execute<CreateStoreCommand, StoreRecord>(command);
    return json(201, await this.attachVerificationToOne(convertStoreToDto(store, keepNativeCurrency, 0)));
  };

  public readonly update = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = StoreParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const body = UpdateStoreBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new UpdateStoreCommand(requireAuthenticatedPrincipal(ctx), params.data.id, body.data);
    return json(200, await this.attachVerificationToOne(convertStoreToDto(await this.commands.execute<UpdateStoreCommand, StoreRecord>(command), keepNativeCurrency)));
  };

  public readonly listMembers = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = StoreParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const query = new ListStoreMembersQuery(requireAuthenticatedPrincipal(ctx), params.data.id);
    const members = await this.queries.execute<ListStoreMembersQuery, readonly StoreMemberRecord[]>(query);
    return json(200, { data: members.map(convertStoreMemberToDto) });
  };

  public readonly addMember = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = StoreParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const body = AddStoreMemberBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new AddStoreMemberCommand(requireAuthenticatedPrincipal(ctx), params.data.id, body.data);
    return json(201, convertStoreMemberToDto(await this.commands.execute<AddStoreMemberCommand, StoreMemberRecord>(command)));
  };

  public readonly removeMember = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = StoreMemberParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const command = new RemoveStoreMemberCommand(requireAuthenticatedPrincipal(ctx), params.data.id, params.data.userId);
    await this.commands.execute<RemoveStoreMemberCommand, void>(command);
    return empty(204);
  };

  public readonly changeStatus = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = StoreParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const body = StoreStatusBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new SuspendStoreCommand(requireAuthenticatedPrincipal(ctx), params.data.id, body.data.status, body.data.reason);
    return json(200, await this.attachVerificationToOne(convertStoreToDto(await this.commands.execute<SuspendStoreCommand, StoreRecord>(command), keepNativeCurrency)));
  };

  public readonly changeFeatured = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = StoreParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const body = FeatureStoreBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new FeatureStoreCommand(requireAuthenticatedPrincipal(ctx), params.data.id, body.data.featured);
    return json(200, await this.attachVerificationToOne(convertStoreToDto(await this.commands.execute<FeatureStoreCommand, StoreRecord>(command), keepNativeCurrency)));
  };

  private async respondWithStore(ctx: HttpRouterContext, query: GetStoreQuery): Promise<HttpResponseContext> {
    const result = await this.queries.execute<GetStoreQuery, StoreWithProductCount>(query);
    return json(200, await this.attachVerificationToOne(convertStoreToDto(result.store, await this.prepareViewerConversion(ctx), result.productCount)));
  }

  private async attachVerification(stores: readonly StoreDto[]): Promise<readonly StoreDto[]> {
    const badges = (await this.verificationBadges?.findVerificationBadges(stores.map((store) => store.id))) ?? new Map<string, VerificationBadge>();
    return stores.map((store) => ({ ...store, verification: badges.get(store.id) ?? UNVERIFIED_STORE_BADGE }));
  }

  private async attachVerificationToOne(store: StoreDto): Promise<StoreDto> {
    return (await this.attachVerification([store]))[0] ?? store;
  }

  private prepareViewerConversion(ctx: HttpRouterContext): Promise<MoneyConversion> {
    return this.currencyConverter.prepareConversionInto(findViewerLocale(ctx).currency);
  }
}
