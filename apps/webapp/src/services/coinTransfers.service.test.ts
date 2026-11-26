import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { coinsService } from "./webActions.service";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("coin transfer API contract", () => {
  it("loads the authoritative quote including exact basis points", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
      calls.push({ url: String(input), init });
      return new Response(JSON.stringify({ coins: 100, feeCoins: 2, netCoins: 98, feePercent: 2, feeBasisPoints: 200 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    const quote = await coinsService.fetchCoinTransferQuote(100);
    assert.equal(quote.feeBasisPoints, 200);
    assert.match(calls[0]!.url, /\/api\/v1\/coins\/transfers\/quote\?coins=100$/);
  });

  it("binds transfer confirmation to the displayed quote and idempotency key", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
      calls.push({ url: String(input), init });
      return new Response(JSON.stringify({ transferId: "transfer_1", coins: 100, feeCoins: 2, netCoins: 98, balance: 400 }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    const receipt = await coinsService.transferCoins("recipient_1", 100, 200, "coin-transfer-key");
    assert.equal(receipt.balance, 400);
    assert.equal(calls[0]?.init.method, "POST");
    assert.deepEqual(JSON.parse(String(calls[0]?.init.body)), { recipientUserId: "recipient_1", coins: 100, expectedFeeBasisPoints: 200 });
    assert.equal((calls[0]?.init.headers as Record<string, string>)?.["Idempotency-Key"], "coin-transfer-key");
  });

  it("surfaces a stale quote conflict for reconfirmation", async () => {
    globalThis.fetch = (async () => new Response(JSON.stringify({ code: "COIN_TRANSFER_FEE_CHANGED", message: "Review the updated quote." }), {
      status: 409,
      headers: { "Content-Type": "application/json" },
    })) as typeof fetch;

    await assert.rejects(coinsService.transferCoins("recipient_1", 100, 200, "coin-transfer-key"), { code: "COIN_TRANSFER_FEE_CHANGED" });
  });
});
