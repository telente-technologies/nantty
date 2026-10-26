import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { dispatchMockApiRequest } from "@/mocks/mockBackend.mock";

import { c, validateAgainstContract } from "./contractSchema.util";

const money = c.object({ amountMinor: c.number(), currency: c.string() });
const errorShape = c.object({ message: c.string(), code: c.string() });
const walletSummary = c.object({
  available: money, pending: money, locked: money, inEscrow: money, payoutRequested: money, negativeBalance: money, nextAvailableAt: c.nullable(c.string()), adCredit: money, earningsPayable: money, debts: money,
  coins: c.object({ spendable: c.number(), earned: c.number() }),
  lines: c.array(c.object({ key: c.string(), label: c.string(), description: c.string(), amount: money })),
  verification: c.object({ level: c.number(), withdrawalsUnlocked: c.boolean(), waitingForVerification: money, nextStep: c.nullable(c.string()), message: c.nullable(c.string()) }),
});
const adsVerification = c.object({ level: c.number(), verified: c.boolean(), nextStep: c.nullable(c.string()), message: c.nullable(c.string()), verifyUrl: c.string() });
const funding = c.object({ fundingId: c.string(), amount: money, status: c.string(["succeeded"]) });
const accountId = "act_ifelifestyle";
const fundPath = `/ads/accounts/${accountId}/billing/fund-from-earnings`;

async function callMock(method: string, path: string, headers: Record<string, string>, body?: unknown) {
  const encoded = body === undefined ? null : new TextEncoder().encode(JSON.stringify(body));
  const response = await dispatchMockApiRequest({ method, path, query: new URLSearchParams(), headers: new Headers({ "content-type": "application/json", ...headers }), body: encoded });
  return { status: response.status, body: response.body as Record<string, unknown> };
}

async function signIn(identifier: string) {
  const login = await callMock("POST", "/auth/login", {}, { identifier, password: "Nantty2026!" });
  return { authorization: `Bearer ${String(login.body.accessToken)}` };
}

describe("wallet, verification and pay-from-balance mocks match the contract", () => {
  it("GET /wallets/me returns separate lines in order, coins in COIN", async () => {
    const wallet = await callMock("GET", "/wallets/me", await signIn("adaeze@ifelifestyle.ng"));
    assert.equal(wallet.status, 200);
    assert.deepEqual(validateAgainstContract(walletSummary, wallet.body), []);
    const lines = wallet.body.lines as { key: string; amount: { currency: string } }[];
    assert.deepEqual(lines.map((line) => line.key), ["available", "pending", "locked", "earningsPayable", "adCredit", "coins", "debts"]);
    assert.equal(lines.find((line) => line.key === "coins")?.amount.currency, "COIN");
  });

  it("GET /ads/verification reports L0 users as unverified with a verify URL", async () => {
    const verified = await callMock("GET", "/ads/verification", await signIn("adaeze@ifelifestyle.ng"));
    assert.deepEqual(validateAgainstContract(adsVerification, verified.body), []);
    assert.equal(verified.body.verified, true);
    const unverified = await callMock("GET", "/ads/verification", await signIn("ibrahim@ifelifestyle.ng"));
    assert.equal(unverified.body.verified, false);
  });

  it("L0 users get 403 VERIFICATION_REQUIRED on top-ups", async () => {
    const response = await callMock("POST", `/ads/accounts/${accountId}/billing/top-ups`, { ...(await signIn("ibrahim@ifelifestyle.ng")), "idempotency-key": "k1" }, { amount: { amountMinor: 1_000_000, currency: "NGN" }, provider: "flutterwave" });
    assert.equal(response.status, 403);
    assert.equal(response.body.code, "VERIFICATION_REQUIRED");
    assert.deepEqual(validateAgainstContract(errorShape, response.body), []);
  });

  it("fund-from-earnings is idempotent and maps errors", async () => {
    const headers = await signIn("adaeze@ifelifestyle.ng");
    const body = { amount: { amountMinor: 100_000, currency: "NGN" } };
    const first = await callMock("POST", fundPath, { ...headers, "idempotency-key": "fund-contract-1" }, body);
    assert.equal(first.status, 201);
    assert.deepEqual(validateAgainstContract(funding, first.body), []);
    const replay = await callMock("POST", fundPath, { ...headers, "idempotency-key": "fund-contract-1" }, body);
    assert.equal(replay.body.fundingId, first.body.fundingId);
    const reused = await callMock("POST", fundPath, { ...headers, "idempotency-key": "fund-contract-1" }, { amount: { amountMinor: 200_000, currency: "NGN" } });
    assert.equal(reused.status, 409);
    assert.equal(reused.body.code, "IDEMPOTENCY_KEY_REUSED");
    const tooMuch = await callMock("POST", fundPath, { ...headers, "idempotency-key": "fund-contract-2" }, { amount: { amountMinor: 999_999_999_00, currency: "NGN" } });
    assert.equal(tooMuch.status, 422);
    assert.equal(tooMuch.body.code, "INSUFFICIENT_FUNDS");
  });
});
