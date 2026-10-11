import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { register } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { describeErrorSignal } from "@zudomart/web-kit/src/errorExperience/core";
import { readErrorMessageForDisplay, sendRequestToWebappServer, WebappRequestError } from "@/services/clientApi.service";

register(pathToFileURL(resolve(process.cwd(), "../../packages/webKit/src/dialog/__tests__/cssStub.loader.mjs")).href);

async function captureFailure(response: Response): Promise<WebappRequestError> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => response) as typeof fetch;
  try {
    await sendRequestToWebappServer("/api/v1/anything");
  } catch (caught) {
    assert.ok(caught instanceof WebappRequestError);
    return caught;
  } finally {
    globalThis.fetch = originalFetch;
  }
  throw new Error("expected the request to fail");
}

describe("API errors carry what the error screens need", () => {
  it("reads the request id and Retry-After for a 429 and maps it to the rate-limit screen", async () => {
    const error = await captureFailure(new Response(JSON.stringify({ code: "RATE_LIMITED", message: "Too many requests." }), { status: 429, headers: { "content-type": "application/json", "x-request-id": "req-abc123", "retry-after": "42" } }));
    assert.equal(error.requestId, "req-abc123");
    assert.equal(error.retryAfterSeconds, 42);
    const descriptor = describeErrorSignal(error);
    assert.equal(descriptor.kind, "rateLimited");
    assert.equal(descriptor.reference, "req-abc123");
  });

  it("never shows raw backend text for server failures", async () => {
    const error = await captureFailure(new Response(JSON.stringify({ code: "INTERNAL", message: "pq: relation \"orders\" does not exist" }), { status: 500, headers: { "content-type": "application/json", "x-request-id": "req-500" } }));
    assert.doesNotMatch(readErrorMessageForDisplay(error), /pq:|relation/);
    assert.equal(describeErrorSignal(error).kind, "serverError");
  });

  it("gives a friendly message when the body is missing", async () => {
    const error = await captureFailure(new Response("<html>bad gateway</html>", { status: 502 }));
    assert.equal(error.code, "HTTP_502");
    assert.doesNotMatch(error.message, /something went wrong/i);
    assert.equal(describeErrorSignal(error).kind, "maintenance");
  });

  it("keeps specific backend copy for domain errors", async () => {
    const error = await captureFailure(new Response(JSON.stringify({ code: "USERNAME_UNAVAILABLE", message: "That username is taken." }), { status: 409, headers: { "content-type": "application/json" } }));
    assert.equal(readErrorMessageForDisplay(error), "That username is taken.");
  });

  it("maps session expiry, step-up and verification codes to their screens", () => {
    assert.equal(describeErrorSignal(new WebappRequestError(401, "SESSION_EXPIRED", "x")).kind, "sessionExpired");
    assert.equal(describeErrorSignal(new WebappRequestError(403, "STEP_UP_REQUIRED", "x")).kind, "stepUpRequired");
    assert.equal(describeErrorSignal(new WebappRequestError(403, "VERIFICATION_REQUIRED", "x")).kind, "verificationRequired");
    assert.equal(describeErrorSignal(new WebappRequestError(422, "COUNTRY_REQUIRED", "x")).kind, "countryRequired");
  });
});

function stubCssModules(): void {
  const extensions = (require as unknown as { extensions: Record<string, (module: { exports: unknown }) => void> }).extensions;
  extensions[".css"] = (module) => {
    module.exports = new Proxy({}, { get: (_, key) => (key === "__esModule" ? false : typeof key === "string" ? key : undefined) });
  };
}

describe("not-found pages", () => {
  stubCssModules();

  it("render the branded 404 with search and the main destinations", async () => {
    const { createElement } = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { ErrorExperienceProvider } = await import("@zudomart/web-kit");
    const { buildWebappErrorConfig } = await import("@/components/errors/errorExperience.provider");
    const { default: NotFoundPage } = await import("@/app/not-found");
    const html = renderToStaticMarkup(createElement(ErrorExperienceProvider, { value: { ...buildWebappErrorConfig(), renderLink: undefined }, children: createElement(NotFoundPage) }));
    assert.match(html, /This page wandered off/);
    assert.match(html, />404</);
    assert.match(html, /action="\/explore"/);
    for (const href of ["/clips", "/mart", "/live"]) assert.match(html, new RegExp(`href="${href}"`));
  });

  it("render a gone-content screen for a missing product", async () => {
    const { createElement } = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { default: ProductNotFound } = await import("@/app/(app)/product/[productId]/not-found");
    assert.match(renderToStaticMarkup(createElement(ProductNotFound)), /This product isn&#x27;t available/);
  });
});
