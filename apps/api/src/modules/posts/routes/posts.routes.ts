import type { HttpRouter } from "@zudojs/http";

import type { WebKit } from "../../../loaders/web.loader.js";
import { describeRoute } from "../../../utils/openapi.util.js";
import type { LiveController } from "../controllers/live.controller.js";
import type { PostsController } from "../controllers/posts.controller.js";
import {
  CommentBodySchema,
  CommentParamsSchema,
  CreatePostBodySchema,
  LiveCommentBodySchema,
  LiveProductBodySchema,
  PageQuerySchemaForLists,
  PostListQuerySchema,
  PostParamsSchema,
  RepostBodySchema,
  StartLiveBodySchema,
  TagProductsBodySchema,
} from "../validators/posts.validator.js";

const POSTS = "/api/v1/posts";
const LIVE = "/api/v1/live";

export function registerPostsRoutes(router: HttpRouter, controller: PostsController, web: WebKit): void {
  const { guard } = web;
  const write = guard.requirePermission("social:write");
  const anyone = guard.allowAnyone();
  const params = { params: PostParamsSchema };

  router.post(POSTS, controller.create, { ...write, ...describeRoute("posts", "Create a post, clip or story", { body: CreatePostBodySchema }) });
  router.get(`${POSTS}/:id`, controller.get, { ...anyone, ...describeRoute("posts", "Get a post", params) });
  router.delete(`${POSTS}/:id`, controller.remove, { ...write, ...describeRoute("posts", "Delete my post", params) });
  router.post(`${POSTS}/:id/like`, controller.like, { ...write, ...describeRoute("posts", "Like a post", params) });
  router.delete(`${POSTS}/:id/like`, controller.unlike, { ...write, ...describeRoute("posts", "Unlike a post", params) });
  router.post(`${POSTS}/:id/repost`, controller.repost, { ...write, ...describeRoute("posts", "Repost a post", { ...params, body: RepostBodySchema }) });
  router.post(`${POSTS}/:id/share`, controller.share, { ...write, ...describeRoute("posts", "Count a share", params) });
  router.post(`${POSTS}/:id/products`, controller.tagProducts, { ...write, ...describeRoute("posts", "Tag products on my post", { ...params, body: TagProductsBodySchema }) });
  router.get(`${POSTS}/:id/comments`, controller.listComments, { ...anyone, ...describeRoute("posts", "List comments", { ...params, query: PageQuerySchemaForLists }) });
  router.post(`${POSTS}/:id/comments`, controller.addComment, { ...write, ...describeRoute("posts", "Comment or reply", { ...params, body: CommentBodySchema }) });
  router.delete(`${POSTS}/:id/comments/:commentId`, controller.deleteComment, { ...write, ...describeRoute("posts", "Delete a comment", { params: CommentParamsSchema }) });
  router.get("/api/v1/users/:id/posts", controller.listUserPosts, { ...anyone, ...describeRoute("posts", "List a user's posts", { ...params, query: PostListQuerySchema }) });
  router.get("/api/v1/stores/:id/posts", controller.listStorePosts, { ...anyone, ...describeRoute("posts", "List a store's posts", { ...params, query: PageQuerySchemaForLists }) });
  router.get("/api/v1/stories", controller.listStories, { ...guard.requirePermission("feed:read"), ...describeRoute("posts", "Active stories from people I follow") });
}

export function registerLiveRoutes(router: HttpRouter, controller: LiveController, web: WebKit): void {
  const { guard } = web;
  const write = guard.requirePermission("social:write");
  const anyone = guard.allowAnyone();
  const params = { params: PostParamsSchema };

  router.post(LIVE, controller.start, { ...write, ...describeRoute("live", "Start a live session", { body: StartLiveBodySchema }) });
  router.get(LIVE, controller.list, { ...anyone, ...describeRoute("live", "List live sessions", { query: PageQuerySchemaForLists }) });
  router.get(`${LIVE}/:id`, controller.get, { ...anyone, ...describeRoute("live", "Get a live session", params) });
  router.post(`${LIVE}/:id/join`, controller.join, { ...write, ...describeRoute("live", "Join a live session", params) });
  router.post(`${LIVE}/:id/leave`, controller.leave, { ...write, ...describeRoute("live", "Leave a live session", params) });
  router.post(`${LIVE}/:id/end`, controller.end, { ...write, ...describeRoute("live", "End my live session", params) });
  router.get(`${LIVE}/:id/comments`, controller.listComments, { ...anyone, ...describeRoute("live", "List live comments", { ...params, query: PageQuerySchemaForLists }) });
  router.post(`${LIVE}/:id/comments`, controller.addComment, { ...write, ...describeRoute("live", "Comment in a live session", { ...params, body: LiveCommentBodySchema }) });
  router.post(`${LIVE}/:id/products`, controller.addProduct, { ...write, ...describeRoute("live", "Show or pin a product in my live session", { ...params, body: LiveProductBodySchema }) });
}
