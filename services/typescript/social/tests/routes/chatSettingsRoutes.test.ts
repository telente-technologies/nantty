import { createRequestContext, createRouter } from "@nantty/fastify-platform";
import { describe, expect, it, vi } from "vitest";

import { createChatSettingsController, type ChatSettingsHandlers } from "../../src/modules/chatSettings/controllers/chatSettings.controller.js";
import { registerChatSettingsRoutes } from "../../src/modules/chatSettings/routes/chatSettings.routes.js";
import type { ChatSettingsView } from "../../src/modules/chatSettings/models/chatSettings.model.js";
import { createRouteFactory } from "../../src/utils/route.util.js";

const accountId = "01a12b3d-d5cc-7e11-bc61-000000000001";
const route = createRouteFactory({ run: async (_request, execute) => ({ ...(await execute()), replayed: false }) });
const settings: ChatSettingsView = {
  messageRequestsFrom: "everyone",
  preventDirectGroupAdds: false,
  notifications: { messages: true, requests: true, groups: true, streakReminders: false, showMessagePreview: true },
  timezone: "Africa/Lagos",
};

function chatSettingsRouter() {
  const handlers: ChatSettingsHandlers = {
    getChatSettings: vi.fn(async () => settings),
    updateChatSettings: vi.fn(async (command) => ({
      ...settings,
      messageRequestsFrom: command.messageRequestsFrom ?? settings.messageRequestsFrom,
      preventDirectGroupAdds: command.preventDirectGroupAdds ?? settings.preventDirectGroupAdds,
    })),
  };
  const router = createRouter({});
  registerChatSettingsRoutes(router, createChatSettingsController(route, handlers));
  return { router, handlers };
}

async function dispatch(router: ReturnType<typeof createRouter>, method: string, body?: unknown, signedIn = true) {
  const path = "/api/v1/chat/settings";
  return router.dispatch(createRequestContext({
    method: method as never,
    url: path,
    path,
    headers: signedIn ? { "x-nantty-account-id": accountId } : {},
    ...(body === undefined ? {} : { body }),
  }));
}

describe("chat settings routes", () => {
  it("requires authentication for read and write operations", async () => {
    const { router, handlers } = chatSettingsRouter();

    expect((await dispatch(router, "GET", undefined, false)).response.status).toBe(401);
    expect((await dispatch(router, "PATCH", { messageRequestsFrom: "followers" }, false)).response.status).toBe(401);
    expect(handlers.getChatSettings).not.toHaveBeenCalled();
    expect(handlers.updateChatSettings).not.toHaveBeenCalled();
  });

  it("reads settings for the authenticated account", async () => {
    const { router, handlers } = chatSettingsRouter();

    expect((await dispatch(router, "GET")).response.status).toBe(200);
    expect(handlers.getChatSettings).toHaveBeenCalledWith({ accountId });
  });

  it("validates the message-request audience and patches only the supplied field", async () => {
    const { router, handlers } = chatSettingsRouter();

    expect((await dispatch(router, "PATCH", { messageRequestsFrom: "everyone_else" })).response.status).toBe(400);
    expect(handlers.updateChatSettings).not.toHaveBeenCalled();

    expect((await dispatch(router, "PATCH", { messageRequestsFrom: "followers" })).response.status).toBe(200);
    expect(handlers.updateChatSettings).toHaveBeenCalledWith({
      accountId,
      messageRequestsFrom: "followers",
      preventDirectGroupAdds: undefined,
      notifications: undefined,
      timezone: undefined,
    });
  });

  it("persists the optional direct-group-add preference without changing the default", async () => {
    const { router, handlers } = chatSettingsRouter();
    expect((await dispatch(router, "PATCH", { preventDirectGroupAdds: "yes" })).response.status).toBe(400);
    expect((await dispatch(router, "PATCH", { preventDirectGroupAdds: true })).response.status).toBe(200);
    expect(handlers.updateChatSettings).toHaveBeenCalledWith({
      accountId,
      messageRequestsFrom: undefined,
      preventDirectGroupAdds: true,
      notifications: undefined,
      timezone: undefined,
    });
  });
});
