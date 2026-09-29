import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import type { HttpResponseContext, HttpRouterContext } from "@zudojs/http";

import { requireAuthenticatedPrincipal } from "../../../middlewares/authenticate.middleware.js";
import { DEFAULT_ADS_PAGE_SIZE, parseAdsBody, parseAdsInput, readRouteParameter, respondToAdsRequest } from "../../../utils/adsHttp.util.js";
import { empty, json } from "../../../utils/http.util.js";
import { AcceptAdInviteCommand } from "../commands/acceptAdInvite/acceptAdInvite.command.js";
import { ChangeAdMemberRoleCommand } from "../commands/changeAdMemberRole/changeAdMemberRole.command.js";
import { CreateAdAccountCommand } from "../commands/createAdAccount/createAdAccount.command.js";
import { CreateAdInviteCommand } from "../commands/createAdInvite/createAdInvite.command.js";
import { RemoveAdMemberCommand } from "../commands/removeAdMember/removeAdMember.command.js";
import { RevokeAdInviteCommand } from "../commands/revokeAdInvite/revokeAdInvite.command.js";
import { UpdateAdAccountCommand } from "../commands/updateAdAccount/updateAdAccount.command.js";
import { GetAdAccountQuery } from "../queries/getAdAccount/getAdAccount.query.js";
import { GetAdEntitlementsQuery } from "../queries/getAdEntitlements/getAdEntitlements.query.js";
import { ListAdAccountsQuery } from "../queries/listAdAccounts/listAdAccounts.query.js";
import { ListAdActivityQuery } from "../queries/listAdActivity/listAdActivity.query.js";
import { ListAdBusinessProfilesQuery } from "../queries/listAdBusinessProfiles/listAdBusinessProfiles.query.js";
import { ListAdInvitesQuery } from "../queries/listAdInvites/listAdInvites.query.js";
import { ListAdMembersQuery } from "../queries/listAdMembers/listAdMembers.query.js";
import { ListAdMembershipsQuery } from "../queries/listAdMemberships/listAdMemberships.query.js";
import { PreviewAdInviteQuery } from "../queries/previewAdInvite/previewAdInvite.query.js";
import { ActivityQuerySchema, ChangeMemberRoleBodySchema, CreateAdAccountBodySchema, CreateInviteBodySchema, UpdateAdAccountBodySchema } from "../validators/adAccounts.validator.js";

export class AdAccountsController {
  public constructor(private readonly commands: CommandBus, private readonly queries: QueryBus) {}

  public readonly listMemberships = (ctx: HttpRouterContext) => this.query(new ListAdMembershipsQuery(requireAuthenticatedPrincipal(ctx)));

  public readonly listAccounts = (ctx: HttpRouterContext) => this.query(new ListAdAccountsQuery(requireAuthenticatedPrincipal(ctx)));

  public readonly listBusinessProfiles = (ctx: HttpRouterContext) => this.query(new ListAdBusinessProfilesQuery(requireAuthenticatedPrincipal(ctx)));

  public readonly createAccount = (ctx: HttpRouterContext) =>
    respondToAdsRequest(async () => {
      const body = parseAdsBody(CreateAdAccountBodySchema, ctx);
      const command = new CreateAdAccountCommand(requireAuthenticatedPrincipal(ctx), { ...body, storeId: body.storeId ?? null });
      return json(201, await this.commands.execute<CreateAdAccountCommand, unknown>(command));
    });

  public readonly getAccount = (ctx: HttpRouterContext) => this.query(new GetAdAccountQuery(requireAuthenticatedPrincipal(ctx), readRouteParameter(ctx, "accountId")));

  public readonly updateAccount = (ctx: HttpRouterContext) =>
    respondToAdsRequest(async () => {
      const body = parseAdsBody(UpdateAdAccountBodySchema, ctx);
      const changes = { ...(body.name === undefined ? {} : { name: body.name }), ...(body.timezone === undefined ? {} : { timezone: body.timezone }) };
      return json(200, await this.commands.execute<UpdateAdAccountCommand, unknown>(new UpdateAdAccountCommand(requireAuthenticatedPrincipal(ctx), readRouteParameter(ctx, "accountId"), changes)));
    });

  public readonly getEntitlements = (ctx: HttpRouterContext) => this.query(new GetAdEntitlementsQuery(requireAuthenticatedPrincipal(ctx), readRouteParameter(ctx, "accountId")));

  public readonly listMembers = (ctx: HttpRouterContext) => this.query(new ListAdMembersQuery(requireAuthenticatedPrincipal(ctx), readRouteParameter(ctx, "accountId")));

  public readonly changeMemberRole = (ctx: HttpRouterContext) =>
    respondToAdsRequest(async () => {
      const body = parseAdsBody(ChangeMemberRoleBodySchema, ctx);
      const command = new ChangeAdMemberRoleCommand(requireAuthenticatedPrincipal(ctx), readRouteParameter(ctx, "accountId"), readRouteParameter(ctx, "userId"), body.role);
      return json(200, await this.commands.execute<ChangeAdMemberRoleCommand, unknown>(command));
    });

  public readonly removeMember = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    await this.commands.execute<RemoveAdMemberCommand, void>(new RemoveAdMemberCommand(requireAuthenticatedPrincipal(ctx), readRouteParameter(ctx, "accountId"), readRouteParameter(ctx, "userId")));
    return empty(204);
  };

  public readonly listInvites = (ctx: HttpRouterContext) => this.query(new ListAdInvitesQuery(requireAuthenticatedPrincipal(ctx), readRouteParameter(ctx, "accountId")));

  public readonly createInvite = (ctx: HttpRouterContext) =>
    respondToAdsRequest(async () => {
      const body = parseAdsBody(CreateInviteBodySchema, ctx);
      const command = new CreateAdInviteCommand(requireAuthenticatedPrincipal(ctx), readRouteParameter(ctx, "accountId"), body.email, body.role);
      return json(201, await this.commands.execute<CreateAdInviteCommand, unknown>(command));
    });

  public readonly revokeInvite = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const command = new RevokeAdInviteCommand(requireAuthenticatedPrincipal(ctx), readRouteParameter(ctx, "accountId"), readRouteParameter(ctx, "inviteId"));
    await this.commands.execute<RevokeAdInviteCommand, void>(command);
    return empty(204);
  };

  public readonly previewInvite = (ctx: HttpRouterContext) => this.query(new PreviewAdInviteQuery(readRouteParameter(ctx, "token")));

  public readonly acceptInvite = async (ctx: HttpRouterContext): Promise<HttpResponseContext> =>
    json(200, await this.commands.execute<AcceptAdInviteCommand, unknown>(new AcceptAdInviteCommand(requireAuthenticatedPrincipal(ctx), readRouteParameter(ctx, "token"))));

  public readonly listActivity = (ctx: HttpRouterContext) =>
    respondToAdsRequest(async () => {
      const query = parseAdsInput(ActivityQuerySchema, ctx.query);
      const activityQuery = new ListAdActivityQuery(requireAuthenticatedPrincipal(ctx), readRouteParameter(ctx, "accountId"), query.objectType, query.cursor, query.limit ?? DEFAULT_ADS_PAGE_SIZE);
      return json(200, await this.queries.execute<ListAdActivityQuery, unknown>(activityQuery));
    });

  private async query(query: Parameters<QueryBus["execute"]>[0]): Promise<HttpResponseContext> {
    return json(200, await this.queries.execute<typeof query, unknown>(query));
  }
}
