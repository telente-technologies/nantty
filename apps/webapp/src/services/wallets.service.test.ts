import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { walletsService } from "./wallets.service";

const originalFetch = globalThis.fetch;

function captureNextRequest(): { readonly calls: { url: string; init: RequestInit }[] } {
  const record = { calls: [] as { url: string; init: RequestInit }[] };
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    record.calls.push({ url, init });
    return new Response(null, { status: 204 });
  }) as typeof fetch;
  return record;
}

describe("removing a payout account", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("sends the single-use step-up token the backend requires on DELETE", async () => {
    const record = captureNextRequest();
    await walletsService.removePayoutAccount("pa_1", "step-up-token-1");
    assert.equal(record.calls.length, 1);
    const { url, init } = record.calls[0]!;
    assert.equal(init.method, "DELETE");
    assert.match(url, /\/api\/v1\/wallets\/me\/payout-accounts\/pa_1$/);
    assert.equal((init.headers as Record<string, string>)["X-Step-Up-Token"], "step-up-token-1");
  });
});
