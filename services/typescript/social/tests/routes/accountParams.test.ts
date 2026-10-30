import { createRequestContext, createRouter } from "@nantty/fastify-platform";
import { describe, expect, it, vi } from "vitest";

import { createFollowsController, type FollowsHandlers } from "../../src/modules/follows/controllers/follows.controller.js";
import { registerFollowsRoutes } from "../../src/modules/follows/routes/follows.routes.js";
import { createPostsController, type PostsHandlers } from "../../src/modules/posts/controllers/posts.controller.js";
import { registerPostsRoutes } from "../../src/modules/posts/routes/posts.routes.js";
import { createRouteFactory } from "../../src/utils/route.util.js";

const route = createRouteFactory({ run: async (_request, execute) => ({ ...(await execute()), replayed: false }) });
const ownerId = "01a12b3d-d5cc-7e11-bc61-000000000001";

function postsRouter(listUserPosts: ReturnType<typeof vi.fn>) {
  const router = createRouter({});
  const handlers = new Proxy({ listUserPosts, listUserStories: listUserPosts } as unknown as PostsHandlers, { get: (target, key) => (target as unknown as Record<string, unknown>)[key as string] ?? vi.fn() });
  registerPostsRoutes(router, createPostsController(route, handlers));
  return router;
}

async function status(router: ReturnType<typeof createRouter>, method: string, path: string): Promise<number> {
  const { response } = await router.dispatch(createRequestContext({ method, url: path, path }));
  return response.status;
}

describe("account id path parameters", () => {
  it("answers a non-UUID user id with 400, never a 500 from the database", async () => {
    const listUserPosts = vi.fn(async () => ({ data: [], nextCursor: null }));
    const router = postsRouter(listUserPosts);
    for (const path of ["/api/v1/users/u_me/posts?kind=clip", "/api/v1/users/not-a-uuid/stories", "/api/v1/users/'; drop table--/posts"]) {
      expect(await status(router, "GET", path), path).toBe(400);
    }
    expect(listUserPosts).not.toHaveBeenCalled();
  });

  it("needs a signed-in viewer for me and passes a real id through", async () => {
    const listUserPosts = vi.fn(async () => ({ data: [], nextCursor: null }));
    const router = postsRouter(listUserPosts);
    expect(await status(router, "GET", "/api/v1/users/me/posts")).toBe(401);
    expect(await status(router, "GET", `/api/v1/users/${ownerId}/posts`)).toBe(200);
    expect(listUserPosts).toHaveBeenCalledWith(expect.objectContaining({ ownerId }));
  });

  it("guards the follow routes the same way", async () => {
    const router = createRouter({});
    const handlers = new Proxy({} as FollowsHandlers, { get: () => vi.fn(async () => ({ data: [], nextCursor: null })) });
    registerFollowsRoutes(router, createFollowsController(route, handlers));
    expect(await status(router, "GET", "/api/v1/users/u_21/followers")).toBe(400);
    expect(await status(router, "GET", "/api/v1/users/me/followers")).toBe(401);
  });
});
