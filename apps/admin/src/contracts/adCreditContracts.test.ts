import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { doesApiCallRequireStepUp, findAdminApiRoute, findApiAccessRequirement, isReasonMissing } from "@/config/apiAccess.config";
import { findRequirementForPagePath } from "@/config/navigation.config";
import { registerAdCreditMockHandlers } from "@/mocks/handlers/trust/adCredits.mock";
import { readMockDatabase } from "@/mocks/mockDatabase.mock";
import { MockHttpError, respondWithError } from "@/mocks/mockResponses.mock";
import { clearEveryMockRoute, findMockRouteForRequest, type MockPrincipal } from "@/mocks/mockRouter.mock";
import { canRevokeAdCredit, convertExpiryDateInputToIsoEndOfDay, describeAdCreditExpiry, isCashbackPercentAllowed, isExpiryInTheFuture } from "@/utils/adCredit.util";
import { toServerListEnvelope } from "@/utils/listEnvelope.util";

import { c, validateAgainstContract } from "./contractSchema.util";

const money = c.object({ amountMinor: c.number(), currency: c.string() });
const staffReference = c.nullable(c.object({ id: c.string(), name: c.string() }));
const adCredit = c.object({
  id: c.string(), userId: c.string(), username: c.string(), accountId: c.string(), source: c.string(["admin_issued", "cashback", "premium_free_boost", "boost_refund", "legacy"]),
  amount: money, remaining: money, expiresAt: c.nullable(c.string()), reason: c.string(), status: c.string(["active", "expired", "revoked", "spent"]),
  issuedBy: staffReference, createdAt: c.string(), revokedAt: c.nullable(c.string()), revokedAmount: c.nullable(money),
});
const cashbackSetting = c.object({ userId: c.string(), username: c.string(), enabled: c.boolean(), percent: c.number(), reason: c.string(), updatedAt: c.string(), updatedBy: staffReference });

clearEveryMockRoute();
registerAdCreditMockHandlers();
const database = readMockDatabase();
const superadmin = database.admins.find((candidate) => candidate.role === "SUPERADMIN");
const support = database.admins.find((candidate) => candidate.role === "SUPPORT");
if (!superadmin || !support) throw new Error("the demo data needs a superadmin and a support admin");
const asPrincipal = (admin: typeof superadmin): MockPrincipal => ({ adminId: admin.id, name: admin.name, email: admin.email, role: admin.role, permissions: admin.permissions, sessionId: `ses_${admin.id}` });
const superadminPrincipal = asPrincipal(superadmin);
const supportPrincipal = asPrincipal(support);
let stepUpCounter = 0;

function issueStepUpToken(principal: MockPrincipal): string {
  stepUpCounter += 1;
  const token = `stepup_ad_credit_${stepUpCounter}`;
  database.stepUpTokens.set(token, { adminId: principal.adminId, sessionId: principal.sessionId, expiresAtEpochMs: Date.now() + 600_000 });
  return token;
}

async function call(method: string, path: string, options: { readonly body?: unknown; readonly query?: string; readonly idempotencyKey?: string; readonly withoutStepUp?: boolean; readonly principal?: MockPrincipal } = {}) {
  const principal = options.principal ?? superadminPrincipal;
  const headers = new Headers(options.withoutStepUp ? {} : { "x-step-up-token": issueStepUpToken(principal) });
  if (options.idempotencyKey) headers.set("idempotency-key", options.idempotencyKey);
  const matched = findMockRouteForRequest(method, path);
  if (!matched) throw new Error(`no mock for ${method} ${path}`);
  let response;
  try {
    response = await matched.route.handler({ method, path, params: matched.params, query: new URLSearchParams(options.query ?? ""), jsonBody: options.body, headers, principal });
  } catch (error) {
    if (!(error instanceof MockHttpError)) throw error;
    response = respondWithError(error.status, error.code, error.message, error.issues);
  }
  return { status: response.status, body: toServerListEnvelope(response.body) as Record<string, unknown> };
}

describe("ad credit endpoints match the ads module contract", () => {
  it("lists issued credit by filter and pages by cursor", async () => {
    const list = await call("GET", "/admin/ads/credits", { query: "status=active" });
    assert.equal(list.status, 200);
    assert.deepEqual(validateAgainstContract(c.page(adCredit), list.body), []);
    assert.ok((list.body.data as { status: string }[]).every((credit) => credit.status === "active"));
    assert.equal((await call("GET", "/admin/ads/credits", { query: "status=ACTIVE" })).status, 400);
  });

  it("issues credit once per idempotency key and refuses a reused key with a different body", async () => {
    const body = { userId: "usr_0004", amount: { amountMinor: 250_000, currency: "NGN" }, expiresAt: null, reason: "Goodwill credit after an outage" };
    assert.equal((await call("POST", "/admin/ads/credits", { body, idempotencyKey: "ad-credit-issue-0001", withoutStepUp: true })).body.code, "STEP_UP_REQUIRED");
    assert.equal((await call("POST", "/admin/ads/credits", { body })).body.code, "IDEMPOTENCY_KEY_REQUIRED");
    const first = await call("POST", "/admin/ads/credits", { body, idempotencyKey: "ad-credit-issue-0002" });
    assert.equal(first.status, 201);
    assert.deepEqual(validateAgainstContract(adCredit, first.body), []);
    const replayed = await call("POST", "/admin/ads/credits", { body, idempotencyKey: "ad-credit-issue-0002" });
    assert.equal(replayed.body.id, first.body.id);
    assert.equal((await call("POST", "/admin/ads/credits", { body: { ...body, amount: { amountMinor: 999, currency: "NGN" } }, idempotencyKey: "ad-credit-issue-0002" })).body.code, "IDEMPOTENCY_KEY_REUSED");
    assert.equal((await call("POST", "/admin/ads/credits", { body: { ...body, reason: "no" }, idempotencyKey: "ad-credit-issue-0003" })).status, 400);
    assert.equal((await call("POST", "/admin/ads/credits", { body: { ...body, expiresAt: "2001-01-01T00:00:00Z" }, idempotencyKey: "ad-credit-issue-0004" })).status, 400);
    assert.equal((await call("POST", "/admin/ads/credits", { body, idempotencyKey: "ad-credit-issue-0005", principal: supportPrincipal })).status, 403);
  });

  it("revokes only the unspent remainder, once", async () => {
    const revoked = await call("POST", "/admin/ads/credits/adc_0001/revoke", { body: { reason: "Promotion ended early" }, idempotencyKey: "ad-credit-revoke-0001" });
    assert.equal(revoked.status, 200);
    assert.deepEqual(validateAgainstContract(adCredit, revoked.body), []);
    assert.deepEqual(revoked.body.revokedAmount, { amountMinor: 1_250_000, currency: "NGN" });
    assert.deepEqual(revoked.body.amount, { amountMinor: 2_000_000, currency: "NGN" });
    assert.equal((await call("POST", "/admin/ads/credits/adc_0001/revoke", { body: { reason: "Promotion ended early" }, idempotencyKey: "ad-credit-revoke-0002" })).body.code, "CREDIT_NOT_REVOCABLE");
    assert.equal((await call("POST", "/admin/ads/credits/adc_0004/revoke", { body: { reason: "Nothing left to take" }, idempotencyKey: "ad-credit-revoke-0003" })).status, 409);
  });

  it("lists and saves per-user cashback with a bounded percent", async () => {
    const list = await call("GET", "/admin/ads/cashback");
    assert.deepEqual(validateAgainstContract(c.page(cashbackSetting), list.body), []);
    const saved = await call("PUT", "/admin/ads/cashback/usr_0005", { body: { enabled: true, percent: 10, reason: "Agency pilot account" }, idempotencyKey: "ad-cashback-0001" });
    assert.equal(saved.status, 200);
    assert.deepEqual(validateAgainstContract(cashbackSetting, saved.body), []);
    assert.equal((await call("PUT", "/admin/ads/cashback/usr_0005", { body: { enabled: true, percent: 75, reason: "Too generous" }, idempotencyKey: "ad-cashback-0002" })).status, 400);
    assert.equal((await call("PUT", "/admin/ads/cashback/usr_0005", { body: { enabled: false, percent: 10, reason: "Pilot over" }, idempotencyKey: "ad-cashback-0003", withoutStepUp: true })).body.code, "STEP_UP_REQUIRED");
  });
});

describe("BFF access rules for ad credit paths", () => {
  it("needs advertisers:manage to change and allows ledger readers to look", () => {
    assert.deepEqual(findApiAccessRequirement("/admin/ads/credits"), { kind: "anyOf", permissions: ["advertisers:manage", "ledger:read"] });
    assert.deepEqual(findApiAccessRequirement("/admin/ads/cashback"), { kind: "anyOf", permissions: ["advertisers:manage", "ledger:read"] });
    assert.deepEqual(findApiAccessRequirement("/admin/ads/credits", "POST"), { kind: "anyOf", permissions: ["advertisers:manage"] });
    assert.deepEqual(findApiAccessRequirement("/admin/ads/credits/adc_1/revoke", "POST"), { kind: "anyOf", permissions: ["advertisers:manage"] });
    assert.deepEqual(findApiAccessRequirement("/admin/ads/cashback/usr_1", "PUT"), { kind: "anyOf", permissions: ["advertisers:manage"] });
    assert.deepEqual(findApiAccessRequirement("/admin/ads/abc"), { kind: "anyOf", permissions: ["ads:review", "advertisers:manage"] });
  });

  it("asks for a single-use step-up and a reason on every ad credit mutation", () => {
    for (const [method, path] of [["POST", "/admin/ads/credits"], ["POST", "/admin/ads/credits/adc_1/revoke"], ["PUT", "/admin/ads/cashback/usr_1"]] as const) {
      const route = findAdminApiRoute(method, path);
      assert.ok(route, `${method} ${path} is routed`);
      assert.equal(doesApiCallRequireStepUp(method, path), true);
      assert.equal(route.singleUseStepUp, true);
      assert.equal(isReasonMissing(route, { reason: "ok" }), true);
      assert.equal(isReasonMissing(route, { reason: "Promotion for sellers" }), false);
    }
    assert.equal(doesApiCallRequireStepUp("GET", "/admin/ads/credits"), false);
  });

  it("gates the page like the routes", () => {
    assert.deepEqual(findRequirementForPagePath("/ads/credit"), ["advertisers:manage", "ledger:read"]);
  });
});

describe("ad credit display rules", () => {
  it("describes expiry, revocability and the cashback bounds", () => {
    assert.equal(describeAdCreditExpiry(null), "No expiry");
    assert.match(describeAdCreditExpiry("2030-05-01T12:00:00Z"), /^Expires on /);
    assert.equal(canRevokeAdCredit({ status: "active", remaining: { amountMinor: 1, currency: "NGN" } }), true);
    assert.equal(canRevokeAdCredit({ status: "active", remaining: { amountMinor: 0, currency: "NGN" } }), false);
    assert.equal(canRevokeAdCredit({ status: "expired", remaining: { amountMinor: 50, currency: "NGN" } }), false);
    assert.deepEqual([0, 1, 10, 50, 51, 10.5].map(isCashbackPercentAllowed), [false, true, true, true, false, false]);
    assert.equal(convertExpiryDateInputToIsoEndOfDay("2030-01-31"), "2030-01-31T23:59:59.000Z");
    assert.equal(convertExpiryDateInputToIsoEndOfDay("31/01/2030"), null);
    assert.equal(isExpiryInTheFuture("2001-01-01T00:00:00Z"), false);
    assert.equal(isExpiryInTheFuture(null), true);
  });
});
