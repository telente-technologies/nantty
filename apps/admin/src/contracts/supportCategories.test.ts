import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { supportCategoryOptions } from "@/constants/supportOptions.constant";
import { registerSupportMacroMockHandlers } from "@/mocks/handlers/content/supportMacros.mock";
import { registerSupportTicketMockHandlers } from "@/mocks/handlers/content/supportTickets.mock";
import { clearEveryMockRoute, findMockRouteForRequest, type MockPrincipal, type MockRequest } from "@/mocks/mockRouter.mock";
import { MockHttpError } from "@/mocks/mockResponses.mock";
import type { SupportTicketCategory } from "@/types/support.type";

const supportAdmin: MockPrincipal = { adminId: "admin_support_categories", name: "Support Agent", email: "support@nantty.test", role: "SUPERADMIN", permissions: [], sessionId: "session_support_categories" };

function mockRequest(method: string, path: string, jsonBody: unknown = null, query = ""): MockRequest {
  return { method, path, params: {}, query: new URLSearchParams(query), jsonBody, headers: new Headers(), principal: supportAdmin };
}

describe("developer and sandbox support categories", () => {
  it("exposes both categories in the Admin ticket filter", () => {
    const categories = supportCategoryOptions.map((option) => option.value);
    assert.ok(categories.includes("DEVELOPER"));
    assert.ok(categories.includes("SANDBOX"));
  });

  it("filters mock support tickets by each new category", async () => {
    clearEveryMockRoute();
    registerSupportTicketMockHandlers();

    for (const category of ["DEVELOPER", "SANDBOX"] as const satisfies readonly SupportTicketCategory[]) {
      const matched = findMockRouteForRequest("GET", "/admin/support/tickets");
      assert.ok(matched);
      const response = await matched.route.handler(mockRequest("GET", "/admin/support/tickets", null, `category=${category}`));
      const body = response.body as { readonly items: readonly { readonly category: string }[] };
      assert.ok(body.items.length > 0, `expected seeded ${category} tickets`);
      assert.ok(body.items.every((ticket) => ticket.category === category));
    }
  });

  it("accepts reply macros scoped to either new category", async () => {
    clearEveryMockRoute();
    registerSupportMacroMockHandlers();

    for (const category of ["DEVELOPER", "SANDBOX"] as const satisfies readonly SupportTicketCategory[]) {
      const path = "/admin/support/macros";
      const matched = findMockRouteForRequest("POST", path);
      assert.ok(matched);
      const request = mockRequest("POST", path, { title: `${category} triage`, body: "Please share the endpoint, timestamp, response status, and request ID. Never share secret credentials.", category });
      const response = await matched.route.handler(request);
      assert.equal(response.status, 201);
      assert.equal((response.body as { readonly category: string }).category, category);
    }
  });

  it("rejects unknown macro categories", async () => {
    clearEveryMockRoute();
    registerSupportMacroMockHandlers();
    const path = "/admin/support/macros";
    const matched = findMockRouteForRequest("POST", path);
    assert.ok(matched);
    await assert.rejects(
      Promise.resolve().then(() => matched.route.handler(mockRequest("POST", path, { title: "Invalid category", body: "This macro body is long enough to pass the minimum length.", category: "API" }))),
      (error: unknown) => error instanceof MockHttpError && error.status === 400,
    );
  });
});
