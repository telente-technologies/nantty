import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { dispatchMockApiRequest } from "@/mocks/mockBackend.mock";

import { c, validateAgainstContract } from "./contractSchema.util";

const promotableDestination = c.object(
  { kind: c.string(["profile", "store"]), id: c.string(), name: c.string(), handle: c.string(), avatarUrl: c.nullable(c.string()), verified: c.boolean(), checkmarkColor: c.string(), private: c.boolean(), available: c.boolean(), eligible: c.boolean(), ineligibleReason: c.nullable(c.string()) },
  ["checkmarkColor"],
);
const accountId = "act_ifelifestyle";

async function callMock(method: string, path: string, headers: Record<string, string>, options: { readonly query?: Record<string, string>; readonly body?: unknown } = {}) {
  const encoded = options.body === undefined ? null : new TextEncoder().encode(JSON.stringify(options.body));
  const response = await dispatchMockApiRequest({ method, path, query: new URLSearchParams(options.query ?? {}), headers: new Headers({ "content-type": "application/json", ...headers }), body: encoded });
  return { status: response.status, body: response.body as Record<string, unknown> };
}

async function signIn(identifier: string) {
  const login = await callMock("POST", "/auth/login", {}, { body: { identifier, password: "Zudomart2026!" } });
  return { authorization: `Bearer ${String(login.body.accessToken)}` };
}

function buildStoreCreative(targetId: string) {
  return { type: "single", mediaClickable: false, cards: [], app: null, format: "store", source: { type: "store", id: "st_ifelifestyle" }, mediaIds: [], headline: "Visit Ife Lifestyle", primaryText: "", callToAction: "visit_store", destination: { type: "store", targetId, url: null } };
}

describe("promotable destinations mock matches the contract", () => {
  it("lists the owner's stores, including suspended ones as ineligible", async () => {
    const response = await callMock("GET", `/ads/accounts/${accountId}/promotable-destinations`, await signIn("adaeze@ifelifestyle.ng"), { query: { type: "store" } });
    assert.equal(response.status, 200);
    assert.deepEqual(validateAgainstContract(c.object({ data: c.array(promotableDestination) }), response.body), []);
    const stores = response.body.data as { id: string; eligible: boolean; ineligibleReason: string | null }[];
    assert.ok(stores.some((store) => store.id === "st_ifelifestyle" && store.eligible));
    assert.ok(stores.some((store) => !store.eligible && Boolean(store.ineligibleReason)));
  });

  it("lists only the owner's own profile", async () => {
    const response = await callMock("GET", `/ads/accounts/${accountId}/promotable-destinations`, await signIn("adaeze@ifelifestyle.ng"), { query: { type: "profile" } });
    assert.deepEqual((response.body.data as { id: string }[]).map((profile) => profile.id), ["usr_adaeze"]);
  });

  it("rejects other types and hides the account from non-members", async () => {
    const live = await callMock("GET", `/ads/accounts/${accountId}/promotable-destinations`, await signIn("adaeze@ifelifestyle.ng"), { query: { type: "live" } });
    assert.equal(live.status, 400);
    assert.equal(live.body.code, "VALIDATION_FAILED");
    const outsider = await callMock("GET", `/ads/accounts/${accountId}/promotable-destinations`, await signIn("kelechi@kelechikicks.ng"), { query: { type: "store" } });
    assert.equal(outsider.status, 404);
  });

  it("refuses a creative that opens a store the account can't promote", async () => {
    const headers = await signIn("adaeze@ifelifestyle.ng");
    const ownStore = await callMock("POST", `/ads/accounts/${accountId}/creatives/preview`, headers, { body: buildStoreCreative("st_ifelifestyle") });
    assert.equal(ownStore.status, 200);
    const otherStore = await callMock("POST", `/ads/accounts/${accountId}/creatives/preview`, headers, { body: buildStoreCreative("st_kelechikicks") });
    assert.equal(otherStore.status, 400);
    assert.ok((otherStore.body.issues as { path: string }[]).some((issue) => issue.path === "creative.destination.targetId"));
  });
});
