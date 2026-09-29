import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import type { HttpResponseContext, HttpRouterContext } from "@zudojs/http";

import { findAuthenticatedPrincipal, requireAuthenticatedPrincipal } from "../../../middlewares/authenticate.middleware.js";
import { findViewerLocale } from "../../../middlewares/viewerLocale.middleware.js";
import type { Page } from "../../../types/pagination.type.js";
import { empty, json, readJsonBody, validationFailed } from "../../../utils/http.util.js";
import { buildPageRequest } from "../../../utils/pagination.util.js";
import { ChangeCommentLikeCommand } from "../commands/changeCommentLike/changeCommentLike.command.js";
import { CommentOnPostCommand } from "../commands/commentOnPost/commentOnPost.command.js";
import { CreatePostCommand } from "../commands/createPost/createPost.command.js";
import { DeleteCommentCommand } from "../commands/deleteComment/deleteComment.command.js";
import { DeletePostCommand } from "../commands/deletePost/deletePost.command.js";
import { LikePostCommand } from "../commands/likePost/likePost.command.js";
import { RepostPostCommand } from "../commands/repostPost/repostPost.command.js";
import { SharePostCommand } from "../commands/sharePost/sharePost.command.js";
import { TagProductsCommand } from "../commands/tagProducts/tagProducts.command.js";
import { UnlikePostCommand } from "../commands/unlikePost/unlikePost.command.js";
import type { CommentDto, PostDto } from "../dtos/posts.dto.js";
import type { StoreDetailDto } from "../queries/getStoreDetail/getStoreDetail.handler.js";
import { GetStoreDetailQuery } from "../queries/getStoreDetail/getStoreDetail.query.js";
import { GetPostQuery } from "../queries/getPost/getPost.query.js";
import { ListPostCommentsQuery } from "../queries/listPostComments/listPostComments.query.js";
import { ListStorePostsQuery } from "../queries/listStorePosts/listStorePosts.query.js";
import { ListUserPostsQuery } from "../queries/listUserPosts/listUserPosts.query.js";
import {
  CommentBodySchema,
  CommentLikeParamsSchema,
  CommentParamsSchema,
  CreatePostBodySchema,
  PageQuerySchemaForLists,
  PostListQuerySchema,
  PostParamsSchema,
  RepostBodySchema,
  TagProductsBodySchema,
} from "../validators/posts.validator.js";

export class PostsController {
  public constructor(private readonly commands: CommandBus, private readonly queries: QueryBus) {}

  public readonly create = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const body = CreatePostBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const post = await this.commands.execute<CreatePostCommand, PostDto>(new CreatePostCommand(requireAuthenticatedPrincipal(ctx), body.data, findViewerLocale(ctx).currency));
    return json(201, post);
  };

  public readonly get = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = PostParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    return json(200, await this.queries.execute<GetPostQuery, PostDto>(new GetPostQuery(findAuthenticatedPrincipal(ctx)?.userId, params.data.id, findViewerLocale(ctx).currency)));
  };

  public readonly remove = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = PostParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    await this.commands.execute<DeletePostCommand, void>(new DeletePostCommand(requireAuthenticatedPrincipal(ctx), params.data.id));
    return empty(204);
  };

  public readonly like = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = PostParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    await this.commands.execute<LikePostCommand, void>(new LikePostCommand(requireAuthenticatedPrincipal(ctx), params.data.id));
    return this.get(ctx);
  };

  public readonly unlike = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = PostParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    await this.commands.execute<UnlikePostCommand, void>(new UnlikePostCommand(requireAuthenticatedPrincipal(ctx), params.data.id));
    return this.get(ctx);
  };

  public readonly repost = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = PostParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const body = RepostBodySchema.safeParse(readJsonBody(ctx) ?? {});
    if (!body.success) return validationFailed(body.issues);
    const command = new RepostPostCommand(requireAuthenticatedPrincipal(ctx), params.data.id, body.data.text ?? "", findViewerLocale(ctx).currency);
    return json(201, await this.commands.execute<RepostPostCommand, PostDto>(command));
  };

  public readonly share = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = PostParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const command = new SharePostCommand(requireAuthenticatedPrincipal(ctx), params.data.id);
    return json(200, await this.commands.execute<SharePostCommand, { readonly shares: number }>(command));
  };

  public readonly tagProducts = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = PostParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const body = TagProductsBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new TagProductsCommand(requireAuthenticatedPrincipal(ctx), params.data.id, body.data.productIds, findViewerLocale(ctx).currency);
    return json(200, await this.commands.execute<TagProductsCommand, PostDto>(command));
  };

  public readonly listComments = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = PostParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const query = PageQuerySchemaForLists.safeParse(ctx.query);
    if (!query.success) return validationFailed(query.issues);
    const listQuery = new ListPostCommentsQuery(findAuthenticatedPrincipal(ctx)?.userId, params.data.id, buildPageRequest(query.data));
    return json(200, await this.queries.execute<ListPostCommentsQuery, Page<CommentDto>>(listQuery));
  };

  public readonly addComment = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = PostParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const body = CommentBodySchema.safeParse(readJsonBody(ctx));
    if (!body.success) return validationFailed(body.issues);
    const command = new CommentOnPostCommand(requireAuthenticatedPrincipal(ctx), params.data.id, body.data.text, body.data.replyToCommentId ?? body.data.parentId ?? null);
    return json(201, await this.commands.execute<CommentOnPostCommand, CommentDto>(command));
  };

  public readonly likeComment = (ctx: HttpRouterContext) => this.changeCommentLike(ctx, true);

  public readonly unlikeComment = (ctx: HttpRouterContext) => this.changeCommentLike(ctx, false);

  private async changeCommentLike(ctx: HttpRouterContext, liked: boolean): Promise<HttpResponseContext> {
    const params = CommentLikeParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const command = new ChangeCommentLikeCommand(requireAuthenticatedPrincipal(ctx), params.data.id, liked);
    return json(200, await this.commands.execute<ChangeCommentLikeCommand, { liked: boolean; likes: number }>(command));
  }

  public readonly deleteComment = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = CommentParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const command = new DeleteCommentCommand(requireAuthenticatedPrincipal(ctx), params.data.id, params.data.commentId);
    await this.commands.execute<DeleteCommentCommand, void>(command);
    return empty(204);
  };

  public readonly listUserPosts = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = PostParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const query = PostListQuerySchema.safeParse(ctx.query);
    if (!query.success) return validationFailed(query.issues);
    const { kind, ...pageQuery } = query.data;
    const listQuery = new ListUserPostsQuery(findAuthenticatedPrincipal(ctx)?.userId, params.data.id, kind, buildPageRequest(pageQuery), findViewerLocale(ctx).currency);
    return json(200, await this.queries.execute<ListUserPostsQuery, Page<PostDto>>(listQuery));
  };

  public readonly getStoreDetail = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = PostParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const query = new GetStoreDetailQuery(findAuthenticatedPrincipal(ctx)?.userId, params.data.id, findViewerLocale(ctx).currency);
    return json(200, await this.queries.execute<GetStoreDetailQuery, StoreDetailDto>(query));
  };

  public readonly listStorePosts = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const params = PostParamsSchema.safeParse(ctx.params);
    if (!params.success) return validationFailed(params.issues);
    const query = PageQuerySchemaForLists.safeParse(ctx.query);
    if (!query.success) return validationFailed(query.issues);
    const listQuery = new ListStorePostsQuery(findAuthenticatedPrincipal(ctx)?.userId, params.data.id, buildPageRequest(query.data), findViewerLocale(ctx).currency);
    return json(200, await this.queries.execute<ListStorePostsQuery, Page<PostDto>>(listQuery));
  };

}
