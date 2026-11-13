import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { useAuthPromptStore } from "@/components/auth/authPrompt.store";

import { adEventsService } from "./adEvents.service";
import { sendRequestToWebappServer } from "./clientApi.service";

const originalFetch = globalThis.fetch;
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");

function stubBrowser() {
  let redirects = 0;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { location: { pathname: "/", search: "", assign: () => { redirects += 1; } } },
  });
  return () => redirects;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  useAuthPromptStore.getState().closeAuthPrompt();
  if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
  else Reflect.deleteProperty(globalThis, "window");
});

describe("background ad telemetry auth failures", () => {
  it("does not open login or redirect guests when ad-event telemetry is unauthenticated", async () => {
    const redirects = stubBrowser();
    globalThis.fetch = (async () => new Response(JSON.stringify({ code: "UNAUTHENTICATED" }), { status: 401, headers: { "content-type": "application/json" } })) as typeof fetch;

    await adEventsService.recordImpressionOncePerSession({ campaignId: "campaign-telemetry-401", label: "Sponsored", advertiserName: "Shop" }, "feed", "item-telemetry-401");

    assert.equal(useAuthPromptStore.getState().isOpen, false);
    assert.equal(redirects(), 0);
  });

  it("does not treat expired-session telemetry as a page-level sign-in action", async () => {
    const redirects = stubBrowser();
    globalThis.fetch = (async () => new Response(JSON.stringify({ code: "SESSION_EXPIRED" }), { status: 401, headers: { "content-type": "application/json" } })) as typeof fetch;

    await adEventsService.recordImpressionOncePerSession({ campaignId: "campaign-telemetry-expired", label: "Sponsored", advertiserName: "Shop" }, "feed", "item-telemetry-expired");

    assert.equal(useAuthPromptStore.getState().isOpen, false);
    assert.equal(redirects(), 0);
  });

  it("keeps sign-in prompting enabled for ordinary protected mutations", async () => {
    stubBrowser();
    globalThis.fetch = (async () => new Response(JSON.stringify({ code: "UNAUTHENTICATED" }), { status: 401, headers: { "content-type": "application/json" } })) as typeof fetch;

    await assert.rejects(sendRequestToWebappServer("/api/v1/posts/p1/like", { method: "POST", body: {} }));
    assert.equal(useAuthPromptStore.getState().isOpen, true);
  });
});
