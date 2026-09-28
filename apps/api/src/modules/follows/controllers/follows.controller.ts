import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import type { HttpResponseContext, HttpRouterContext } from "@zudojs/http";

import type { StoreSummary } from "../../../interfaces/storeAccess.interface.js";
import type { UserSummary } from "../../../interfaces/userDirectory.interface.js";
import { findAuthenticatedPrincipal, requireAuthenticatedPrincipal } from "../../../middlewares/authenticate.middleware.js";
import type { Page } from "../../../types/pagination.type.js";
import { empty, json, validationFailed } from "../../../utils/http.util.js";
import { buildPageRequest } from "../../../utils/pagination.util.js";
import { BlockUserCommand } from "../commands/blockUser/blockUser.command.js";
import { FollowCommand } from "../commands/follow/follow.command.js";
import { UnblockUserCommand } from "../commands/unblockUser/unblockUser.command.js";
import { UnfollowCommand } from "../commands/unfollow/unfollow.command.js";
import type { FollowStatus, FollowTargetType } from "../models/follows.model.js";
import { GetFollowStatusQuery } from "../queries/getFollowStatus/getFollowStatus.query.js";
import { ListBlockedUsersQuery } from "../queries/listBlockedUsers/listBlockedUsers.query.js";
import { ListFollowersQuery } from "../queries/listFollowers/listFollowers.query.js";
import { ListFollowingQuery } from "../queries/listFollowing/listFollowing.query.js";
import { FollowListQuerySchema, TargetParamsSchema } from "../validators/follows.validator.js";

export class FollowsController {
  public constructor(private readonly commands: CommandBus, private readonly queries: QueryBus) {}

  public readonly followUser = (ctx: HttpRouterContext) => this.changeFollow(ctx, "user", true);
  public readonly unfollowUser = (ctx: HttpRouterContext) => this.changeFollow(ctx, "user", false);
  public readonly followStore = (ctx: HttpRouterContext) => this.changeFollow(ctx, "store", true);
  public readonly unfollowStore = (ctx: HttpRouterContext) => this.changeFollow(ctx, "store", false);
  public readonly getUserFollowStatus = (ctx: HttpRouterContext) => this.getFollowStatus(ctx, "user");
  public readonly getStoreFollowStatus = (ctx: HttpRouterContext) => this.getFollowStatus(ctx, "store");
  public readonly listUserFollowers = (ctx: HttpRouterContext) => this.listFollowers(ctx, "user");
  public readonly listStoreFollowers = (ctx: HttpRouterContext) => this.listFollowers(ctx, "store");

  public readonly listFollowing = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = TargetParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const query = FollowListQuerySchema.safeParse(ctx.query);
    if (!query.success) return validationFailed(query.issues);
    const { type, ...pageQuery } = query.data;
    const page = await this.queries.execute<ListFollowingQuery, Page<UserSummary | StoreSummary>>(
      new ListFollowingQuery(params.data.id, type ?? "user", buildPageRequest(pageQuery)),
    );
    return json(200, page);
  };

  public readonly blockUser = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = TargetParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    await this.commands.execute<BlockUserCommand, void>(new BlockUserCommand(requireAuthenticatedPrincipal(ctx), params.data.id));
    return empty(204);
  };

  public readonly unblockUser = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = TargetParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    await this.commands.execute<UnblockUserCommand, void>(new UnblockUserCommand(requireAuthenticatedPrincipal(ctx), params.data.id));
    return empty(204);
  };

  public readonly listBlockedUsers = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const query = FollowListQuerySchema.safeParse(ctx.query);
    if (!query.success) return validationFailed(query.issues);
    const { type: _type, ...pageQuery } = query.data;
    const page = await this.queries.execute<ListBlockedUsersQuery, Page<UserSummary>>(
      new ListBlockedUsersQuery(requireAuthenticatedPrincipal(ctx), buildPageRequest(pageQuery)),
    );
    return json(200, page);
  };

  private async changeFollow(ctx: HttpRouterContext, targetType: FollowTargetType, follow: boolean): Promise<HttpResponseContext> {
    const params = TargetParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const principal = requireAuthenticatedPrincipal(ctx);
    if (follow) await this.commands.execute<FollowCommand, void>(new FollowCommand(principal, targetType, params.data.id));
    else await this.commands.execute<UnfollowCommand, void>(new UnfollowCommand(principal, targetType, params.data.id));
    return this.getFollowStatus(ctx, targetType);
  }

  private async getFollowStatus(ctx: HttpRouterContext, targetType: FollowTargetType): Promise<HttpResponseContext> {
    const params = TargetParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const viewerId = findAuthenticatedPrincipal(ctx)?.userId;
    const status = await this.queries.execute<GetFollowStatusQuery, FollowStatus>(new GetFollowStatusQuery(viewerId, targetType, params.data.id));
    return json(200, status);
  }

  private async listFollowers(ctx: HttpRouterContext, targetType: FollowTargetType): Promise<HttpResponseContext> {
    const params = TargetParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const query = FollowListQuerySchema.safeParse(ctx.query);
    if (!query.success) return validationFailed(query.issues);
    const { type: _type, ...pageQuery } = query.data;
    const page = await this.queries.execute<ListFollowersQuery, Page<UserSummary>>(
      new ListFollowersQuery(targetType, params.data.id, buildPageRequest(pageQuery)),
    );
    return json(200, page);
  }
}
