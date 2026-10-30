import { createRequestContext, createRouter } from "@nantty/fastify-platform";
import { describe, expect, it, vi } from "vitest";

import { createMentionsController, type MentionsHandlers } from "../../src/modules/mentions/controllers/mentions.controller.js";
import { registerMentionsRoutes } from "../../src/modules/mentions/routes/mentions.routes.js";
import { createRouteFactory } from "../../src/utils/route.util.js";

const route = createRouteFactory({ run: async (_request, execute) => ({ ...(await execute()), replayed: false }) });
const accountId = "01a12b3d-d5cc-7e11-bc61-000000000001";
const targetId = "01a12b3d-d5cc-7e11-bc61-000000000002";

function mentionsRouter() {
  const resolveMentionTargets = vi.fn(async ({ userIds }: { readonly userIds: readonly string[] }) =>
    Object.fromEntries(userIds.map((id) => [id, { username: "target", status: "active" as const }])));
  const handlers = { resolveMentionTargets } as unknown as MentionsHandlers;
  const router = createRouter({});
  registerMentionsRoutes(router, createMentionsController(route, handlers));
  return { router, resolveMentionTargets };
}

async function resolve(router: ReturnType<typeof createRouter>, userIds: readonly string[], signedIn: boolean) {
  const { response } = await router.dispatch(createRequestContext({
    method: "POST",
    url: "/api/v1/mentions/resolve",
    path: "/api/v1/mentions/resolve",
    headers: signedIn ? { "x-nantty-account-id": accountId } : {},
    body: JSON.stringify({ userIds }),
  }));
  return response;
}

describe("mention target resolution access", () => {
  it("rejects anonymous account-id lookups before the directory handler runs", async () => {
    const { router, resolveMentionTargets } = mentionsRouter();

    const response = await resolve(router, [targetId], false);

    expect(response.status).toBe(401);
    expect(resolveMentionTargets).not.toHaveBeenCalled();
  });

  it("allows an authenticated composer to resolve a bounded batch", async () => {
    const { router, resolveMentionTargets } = mentionsRouter();

    const response = await resolve(router, [targetId], true);

    expect(response.status).toBe(200);
    expect(resolveMentionTargets).toHaveBeenCalledWith({ userIds: [targetId] });
  });

  it("rejects oversized batches before resolving any account ids", async () => {
    const { router, resolveMentionTargets } = mentionsRouter();

    const response = await resolve(router, Array.from({ length: 101 }, (_, index) => `account-${index}`), true);

    expect(response.status).toBe(400);
    expect(resolveMentionTargets).not.toHaveBeenCalled();
  });
});
