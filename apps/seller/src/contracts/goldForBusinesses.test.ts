import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { findPermissionRequiredForApiCall } from "@/config/rolePermissions.config";
import { dispatchMockApiRequest } from "@/mocks/mockBackend.mock";

import { c, validateAgainstContract } from "./contractSchema.util";

async function callMock(method: string, path: string, headers: Record<string, string>, body?: unknown) {
  const encoded = body === undefined ? null : new TextEncoder().encode(JSON.stringify(body));
  const response = await dispatchMockApiRequest({ method, path, query: new URLSearchParams(), headers: new Headers({ "content-type": "application/json", ...headers }), body: encoded });
  return { status: response.status, body: response.body as Record<string, unknown> };
}

const coveredProfileContract = c.object({ profileId: c.string(), displayName: c.string(), profileType: c.string(["business", "brand"]), coverage: c.string(["none", "pending", "active", "removing"]), hasOwnGold: c.boolean() });
const goldForBusinessesContract = c.object({
  premium: c.boolean(),
  rules: c.object({ maximumProfiles: c.number(), yearlyExtraBps: c.number(), yearlyMode: c.string(["replace", "add"]), tiers: c.array(c.object({ profiles: c.number(), discountBps: c.number() })) }),
  businesses: c.array(coveredProfileContract),
  subscription: c.nullable(c.object({
    id: c.string(),
    status: c.string(),
    interval: c.string(["month", "year"]),
    price: c.object({ amountMinor: c.number(), currency: c.string() }),
    discountKind: c.string(["multi_business", "offer", "yearly", "none"]),
    currentPeriodEnd: c.nullable(c.string()),
    cancelAtPeriodEnd: c.boolean(),
    coveredProfiles: c.array(coveredProfileContract),
  })),
});

async function signIn(identifier: string) {
  const login = await callMock("POST", "/auth/login", {}, { identifier, password: "Nantty2026!" });
  return `Bearer ${(login.body as { accessToken: string }).accessToken}`;
}

describe("GET /subscriptions/gold-for-businesses", () => {
  it("is a signed-in read the BFF allows", () => {
    assert.equal(findPermissionRequiredForApiCall("GET", "/subscriptions/gold-for-businesses"), "signed_in");
    assert.equal(findPermissionRequiredForApiCall("POST", "/subscriptions/gold-for-businesses/checkout"), null);
  });

  it("returns the combined plan for an owner who has it", async () => {
    const response = await callMock("GET", "/subscriptions/gold-for-businesses", { authorization: await signIn("adaeze@ifelifestyle.ng") });
    assert.equal(response.status, 200);
    assert.deepEqual(validateAgainstContract(goldForBusinessesContract, response.body), []);
    assert.ok(response.body.subscription);
  });

  it("rejects anonymous calls", async () => {
    const response = await callMock("GET", "/subscriptions/gold-for-businesses", {});
    assert.equal(response.status, 401);
  });
});
