import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { startTestServer } from "../fakes/httpTestServer.fake.js";
import { createSearchHarness, envelope } from "../fakes/searchHarness.fake.js";
import { accountA, accountB, productSource, userSource } from "../fakes/sourceFixtures.fake.js";

const internalToken = "internal-token-0123456789";
let baseUrl = "";
let stop: () => Promise<void>;
const harness = createSearchHarness();

beforeAll(async () => {
  harness.hydrator.products.set("prod_1", productSource());
  harness.hydrator.users.set(accountA, userSource());
  const server = await startTestServer({ searchService: harness.service, recentSearches: harness.store, eventProcessor: harness.processor, internalToken, probeDatabase: undefined });
  ({ baseUrl, stop } = server);
});

afterAll(async () => stop());

const asAccount = (accountId: string) => ({ "x-zudomart-account-id": accountId });

describe("search http routes", () => {
  it("keeps probes, not-found behavior, and unsupported methods explicit", async () => {
    expect(await (await fetch(`${baseUrl}/healthz`)).json()).toEqual({ status: "up", service: "search" });
    expect(await (await fetch(`${baseUrl}/readyz`)).json()).toEqual({ status: "ready" });
    const missing = await fetch(`${baseUrl}/missing`);
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ message: "Not found.", code: "NOT_FOUND" });
    const method = await fetch(`${baseUrl}/api/v1/search`, { method: "POST" });
    expect(method.status).toBe(405);
    expect(await method.json()).toEqual({ message: "Method not allowed.", code: "METHOD_NOT_ALLOWED" });
  });

  it("rejects a missing or oversized query", async () => {
    expect((await fetch(`${baseUrl}/api/v1/search`)).status).toBe(400);
    expect((await fetch(`${baseUrl}/api/v1/search?q=${"a".repeat(101)}`)).status).toBe(400);
    expect((await fetch(`${baseUrl}/api/v1/search?q=a&scope=bogus`)).status).toBe(400);
    for (const scope of ["store:store_1", "profile:not-a-uuid", "profile:", "shop:" + accountA, `profile:${accountA}x`]) expect((await fetch(`${baseUrl}/api/v1/search?q=a&scope=${encodeURIComponent(scope)}`)).status).toBe(400);
    expect((await fetch(`${baseUrl}/api/v1/search?q=a&type=bogus`)).status).toBe(400);
  });

  it("accepts the context scopes and echoes the canonical scope", async () => {
    for (const scope of ["global", "mart", `store:${accountB}`, `profile:${accountA.toUpperCase()}`]) {
      const response = await fetch(`${baseUrl}/api/v1/search?q=sneakers&scope=${encodeURIComponent(scope)}&type=top`);
      expect(response.status).toBe(200);
      expect(((await response.json()) as { scope: string }).scope).toBe(scope.toLowerCase());
    }
    const grouped = (await (await fetch(`${baseUrl}/api/v1/search?q=sneakers&scope=mart&type=all`)).json()) as { data: unknown[]; nextCursor: null };
    expect(grouped.nextCursor).toBeNull();
    expect(Array.isArray(grouped.data)).toBe(true);
  });

  it("indexes through the internal endpoint and answers searches, grouped and paged", async () => {
    const body = JSON.stringify(envelope("product.published", { productId: "prod_1", storeId: "store_1" }));
    expect((await fetch(`${baseUrl}/internal/search/events`, { method: "POST", body })).status).toBe(401);
    const accepted = await fetch(`${baseUrl}/internal/search/events`, { method: "POST", body, headers: { "x-internal-token": internalToken } });
    expect(await accepted.json()).toEqual({ outcome: "handled" });
    const page = (await (await fetch(`${baseUrl}/api/v1/search?q=sneakers&scope=products`)).json()) as { data: { id: string; type: string; price: unknown }[]; nextCursor: string | null };
    expect(page).toEqual({ data: [expect.objectContaining({ id: "prod_1", type: "product", price: { amountMinor: 2500000, currency: "NGN" } })], nextCursor: null, scope: "global" });
    const grouped = (await (await fetch(`${baseUrl}/api/v1/search?q=sneakers&scope=all`)).json()) as { products: unknown[]; people: unknown[] };
    expect(grouped.products).toHaveLength(1);
    expect(grouped.people).toEqual([]);
    const suggestions = (await (await fetch(`${baseUrl}/api/v1/search/suggest?q=sneak`)).json()) as { data: { text: string }[] };
    expect(suggestions.data[0]?.text).toBe("Red running sneakers");
  });

  it("answers invalid events with 400 and replays duplicates", async () => {
    const response = await fetch(`${baseUrl}/internal/search/events`, { method: "POST", body: JSON.stringify({ nope: true }), headers: { "x-internal-token": internalToken } });
    expect(response.status).toBe(400);
    const malformed = await fetch(`${baseUrl}/internal/search/events`, { method: "POST", body: "{", headers: { "content-type": "application/json", "x-internal-token": internalToken } });
    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toEqual({ message: "The request body is not valid JSON.", code: "INVALID_JSON" });
    const types = await fetch(`${baseUrl}/internal/search/event-types`);
    expect(types.status).toBe(401);
  });

  it("keeps recent searches per account, newest first, capped and removable", async () => {
    expect((await fetch(`${baseUrl}/api/v1/search/recent`)).status).toBe(401);
    for (const q of ["sneakers", "Ada", "sneakers"]) await fetch(`${baseUrl}/api/v1/search/recent`, { method: "POST", body: JSON.stringify({ q }), headers: asAccount(accountA) });
    const listed = (await (await fetch(`${baseUrl}/api/v1/search/recent`, { headers: asAccount(accountA) })).json()) as { data: { id: string; query: string }[] };
    expect(listed.data.map((item) => item.query)).toEqual(["sneakers", "Ada"]);
    expect(((await (await fetch(`${baseUrl}/api/v1/search/recent`, { headers: asAccount(accountB) })).json()) as { data: unknown[] }).data).toEqual([]);
    expect((await fetch(`${baseUrl}/api/v1/search/recent/${listed.data[0]?.id}`, { method: "DELETE", headers: asAccount(accountA) })).status).toBe(204);
    expect((await fetch(`${baseUrl}/api/v1/search/recent/not-a-uuid`, { method: "DELETE", headers: asAccount(accountA) })).status).toBe(400);
    expect((await fetch(`${baseUrl}/api/v1/search/recent`, { method: "DELETE", headers: asAccount(accountA) })).status).toBe(204);
    expect(((await (await fetch(`${baseUrl}/api/v1/search/recent`, { headers: asAccount(accountA) })).json()) as { data: unknown[] }).data).toEqual([]);
  });

  it("keeps recent searches per scope", async () => {
    const profileScope = `profile:${accountB}`;
    const record = (q: string, scope?: string) => fetch(`${baseUrl}/api/v1/search/recent`, { method: "POST", body: JSON.stringify(scope === undefined ? { q } : { q, scope }), headers: asAccount(accountA) });
    const list = async (scope?: string) => ((await (await fetch(`${baseUrl}/api/v1/search/recent${scope === undefined ? "" : `?scope=${encodeURIComponent(scope)}`}`, { headers: asAccount(accountA) })).json()) as { data: { query: string; scope: string }[] }).data;
    await record("global thing");
    await record("mart thing", "mart");
    await record("profile thing", profileScope);
    expect((await record("bad", "store:nope")).status).toBe(400);
    expect((await list()).map((item) => item.query)).toEqual(["global thing"]);
    expect((await list("mart")).map((item) => item.query)).toEqual(["mart thing"]);
    expect(await list(profileScope)).toEqual([expect.objectContaining({ query: "profile thing", scope: profileScope })]);
    expect((await fetch(`${baseUrl}/api/v1/search/recent?scope=mart`, { method: "DELETE", headers: asAccount(accountA) })).status).toBe(204);
    expect(await list("mart")).toEqual([]);
    expect(await list()).toHaveLength(1);
    expect((await fetch(`${baseUrl}/api/v1/search/recent?scope=bogus`, { headers: asAccount(accountA) })).status).toBe(400);
  });
});
