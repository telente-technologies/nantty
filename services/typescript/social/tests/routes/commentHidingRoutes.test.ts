import { createRequestContext, createRouter } from "@nantty/fastify-platform";
import { describe, expect, it, vi } from "vitest";

import { createCommentsController, type CommentsHandlers } from "../../src/modules/comments/controllers/comments.controller.js";
import { registerCommentsRoutes } from "../../src/modules/comments/routes/comments.routes.js";
import { createRouteFactory } from "../../src/utils/route.util.js";

const route = createRouteFactory({ run: async (_request, execute) => ({ ...(await execute()), replayed: false }) });
const ownerId = "01a12b3d-d5cc-7e11-bc61-000000000001";
const postId = "01a12b3d-d5cc-7e11-bc61-0000000000a1";
const commentId = "01a12b3d-d5cc-7e11-bc61-0000000000c1";

function commentsRouter() {
  const calls = new Map<string, ReturnType<typeof vi.fn>>();
  const handlers = new Proxy({} as CommentsHandlers, {
    get: (_target, key: string) => {
      if (!calls.has(key)) calls.set(key, vi.fn(async () => ({ data: [], nextCursor: null })));
      return calls.get(key);
    },
  });
  const router = createRouter({});
  registerCommentsRoutes(router, createCommentsController(route, handlers));
  return { router, calls };
}

async function status(router: ReturnType<typeof createRouter>, method: string, path: string, signedIn = true): Promise<number> {
  const query = Object.fromEntries(new URL(`http://local${path}`).searchParams);
  const { response } = await router.dispatch(createRequestContext({ method: method as never, url: path, path: path.split("?")[0], query, headers: signedIn ? { "x-nantty-account-id": ownerId } : {} }));
  return response.status;
}

describe("comment hiding routes", () => {
  it("needs a signed-in account to hide, unhide or list comments on my posts", async () => {
    const { router, calls } = commentsRouter();
    expect(await status(router, "PUT", `/api/v1/posts/${postId}/comments/${commentId}/hide`, false)).toBe(401);
    expect(await status(router, "DELETE", `/api/v1/posts/${postId}/comments/${commentId}/hide`, false)).toBe(401);
    expect(await status(router, "GET", "/api/v1/me/post-comments", false)).toBe(401);
    expect(calls.get("hideComment")).toBeUndefined();
  });

  it("validates ids and filters before reaching a handler", async () => {
    const { router, calls } = commentsRouter();
    expect(await status(router, "PUT", `/api/v1/posts/not-a-post/comments/${commentId}/hide`)).toBe(400);
    expect(await status(router, "GET", "/api/v1/me/post-comments?filter=spam")).toBe(400);
    expect(await status(router, "GET", "/api/v1/me/post-comments?cursor=abc")).toBe(400);
    expect(await status(router, "GET", "/api/v1/me/post-comments?filter=hidden&limit=5")).toBe(200);
    expect(calls.get("listMyPostComments")).toHaveBeenCalledWith(expect.objectContaining({ ownerId, filter: "hidden", limit: 5 }));
    expect(await status(router, "GET", "/api/v1/me/post-comments")).toBe(200);
    expect(calls.get("listMyPostComments")).toHaveBeenLastCalledWith(expect.objectContaining({ filter: "all", limit: 20 }));
    expect(await status(router, "PUT", `/api/v1/posts/${postId}/comments/${commentId}/hide`)).toBe(200);
    expect(calls.get("hideComment")).toHaveBeenCalledWith({ actorId: ownerId, postId, commentId });
  });
});
