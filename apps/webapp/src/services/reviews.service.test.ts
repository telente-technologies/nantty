import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { reviewsService } from "./reviews.service";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("product review deletion", () => {
  it("uses the authenticated own-review DELETE endpoint with encoded identifiers", async () => {
    let requestUrl = "";
    let requestMethod = "";
    globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
      requestUrl = String(input);
      requestMethod = init.method ?? "GET";
      return new Response(null, { status: 204 });
    }) as typeof fetch;

    await reviewsService.deleteOwnReview("review/with-reserved-chars");

    assert.equal(requestUrl, "/bff/api/v1/reviews/review%2Fwith-reserved-chars");
    assert.equal(requestMethod, "DELETE");
  });
});
