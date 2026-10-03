import { describe, expect, it } from "vitest";

import { resolveUpstreamRouteForRequest } from "../src/routes/upstream.routes.js";

describe("notifications routes", () => {
  const cases: ReadonlyArray<readonly [string, string, "required" | "optional" | "identity-fallback"]> = [
    ["GET", "/api/v1/notifications", "required"],
    ["POST", "/api/v1/notifications/read-all", "required"],
    ["POST", "/api/v1/notifications/abc/read", "required"],
    ["GET", "/api/v1/notifications/unread-count", "required"],
    ["PATCH", "/api/v1/notifications/preferences", "required"],
    ["POST", "/api/v1/email/unsubscribe", "optional"],
    ["POST", "/api/v1/admin/support/email/send", "optional"],
    ["GET", "/api/v1/admin/support/email/segments", "optional"],
    ["GET", "/api/v1/admin/legal/notices", "optional"],
    ["POST", "/api/v1/admin/legal/notices", "optional"],
    ["GET", "/api/v1/admin/legal/versions/v1/notice-draft", "optional"],
    ["POST", "/api/v1/admin/legal/versions/v1/notice-draft/test-send", "optional"],
    ["GET", "/api/v1/admin/legal/versions/v1/notice-preview", "optional"],
    ["GET", "/api/v1/admin/legal/versions/v1", "identity-fallback"],
    ["GET", "/api/v1/admin/support/tickets", "identity-fallback"],
  ];

  it.each(cases)("%s %s", (method, path, expected) => {
    const route = resolveUpstreamRouteForRequest(method, path);
    if (expected === "identity-fallback") {
      expect(route?.upstream).toBe("identity");
      return;
    }
    expect(route?.upstream).toBe("notifications");
    expect(route?.authentication).toBe(expected);
  });
});
