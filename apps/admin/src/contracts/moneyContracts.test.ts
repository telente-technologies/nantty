import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { doesApiCallRequireStepUp, findApiAccessRequirement } from "@/config/apiAccess.config";
import { registerMoneyMockHandlers } from "@/mocks/handlers/money/moneyHandlers.mock";
import { readMockDatabase } from "@/mocks/mockDatabase.mock";
import { MockHttpError, respondWithError } from "@/mocks/mockResponses.mock";
import { clearEveryMockRoute, findMockRouteForRequest, type MockPrincipal } from "@/mocks/mockRouter.mock";
import { toServerListEnvelope } from "@/utils/listEnvelope.util";

import { c, validateAgainstContract, type ContractSchema } from "./contractSchema.util";

const money = c.object({ amountMinor: c.number(), currency: c.string() });
const party = c.object({ id: c.string(), name: c.nullable(c.string()), username: c.nullable(c.string()) });
const orderParty = c.object({ id: c.string(), username: c.string(), displayName: c.string(), avatarUrl: c.nullable(c.string()) });
const counted = (item: ContractSchema, counts: readonly string[]) => c.object({ data: c.array(item), nextCursor: c.nullable(c.string()), counts: c.object(Object.fromEntries(counts.map((key) => [key, c.number()]))) });

const coinTransaction = c.object({
  id: c.string(), kind: c.string(["purchase", "transfer"]), reference: c.nullable(c.string()), sender: party, receiver: c.nullable(party), coins: c.number(), feeCoins: c.nullable(c.number()),
  platformFeeBasisPoints: c.nullable(c.number()), fiatValue: c.nullable(money), paymentProvider: c.nullable(c.string()), channel: c.nullable(c.string()), transactionStatus: c.string(),
  reviewStatus: c.string(["not_required", "pending_review", "reviewed", "reversed"]), reviewFlags: c.array(c.string()), flags: c.array(c.string()), chargebackRisk: c.string(["low", "medium", "high"]),
  clawbackShortfallCoins: c.number(), createdAt: c.string(), reviewedAt: c.nullable(c.string()), reviewedByStaffId: c.nullable(c.string()), reviewNote: c.nullable(c.string()),
});
const withdrawalStatuses = ["pending_review", "on_hold", "queued", "processing", "paid", "failed", "cancelled"];
const withdrawal = c.object({
  id: c.string(), kind: c.string(), amount: money, description: c.string(), createdAt: c.string(), status: c.string(), reference: c.string(), fee: money, netAmount: money,
  withdrawalStatus: c.string(withdrawalStatuses), payoutAccountId: c.string(), failureReason: c.nullable(c.string()), processedAt: c.nullable(c.string()), userId: c.string(), user: party, provider: c.string(),
  destination: c.nullable(c.object({ payoutAccountId: c.string(), bankName: c.string(), accountLast4: c.string(), accountName: c.string(), countryCode: c.string(), addedAt: c.string(), removed: c.boolean() })),
  reviewedByStaffId: c.nullable(c.string()), reviewedAt: c.nullable(c.string()), reviewNote: c.nullable(c.string()),
});
const journalEntry = c.object({
  id: c.string(), reference: c.string(), externalReference: c.nullable(c.string()), kind: c.string(), description: c.string(), reversesEntryId: c.nullable(c.string()), postedAt: c.string(),
  legs: c.array(c.object({ accountCode: c.string(), accountName: c.string(), direction: c.string(["debit", "credit"]), amount: money })), totalDebits: money, totalCredits: money, isBalanced: c.boolean(),
});
const ledgerAccount = c.object({ code: c.string(), name: c.string(), kind: c.string(["asset", "liability", "equity", "revenue", "expense"]), currency: c.string(), balance: money, ownerType: c.nullable(c.string()), ownerId: c.nullable(c.string()), entryCount: c.number() });
const orderSummaryFields = {
  id: c.string(), orderNumber: c.string(), invoiceNumber: c.string(), buyer: orderParty, seller: orderParty, storeId: c.string(), storeName: c.string(), status: c.string(), paymentStatus: c.string(),
  paymentMode: c.string(), escrowStatus: c.string(), deliveryStatus: c.string(), total: money, itemCount: c.number(), placedAt: c.string(),
};
const refund = c.object({ id: c.string(), orderId: c.string(), orderNumber: c.string(), storeId: c.string(), buyer: orderParty, amount: money, source: c.string(["manual", "seller", "return", "cancellation", "dispute", "system"]), status: c.string(["processing", "scheduled", "completed", "failed"]), reason: c.string(), createdAt: c.string(), completedAt: c.nullable(c.string()), createdByName: c.string() });
const logisticsShipment = c.object({
  shipmentId: c.string(), orderId: c.string(), storeId: c.string(), reference: c.string(), provider: c.string(),
  status: c.string(["pending", "quoted", "booked", "picked_up", "in_transit", "delivered", "cancelled", "failed"]),
  trackingNumber: c.nullable(c.string()), trackingUrl: c.nullable(c.string()),
  createdAt: c.string(), updatedAt: c.string(), exception: c.nullable(c.object({ reason: c.string(), status: c.string() })),
});
const orderDetail = c.object({
  ...orderSummaryFields, items: c.array(c.object({ id: c.string(), productId: c.string(), productName: c.string(), variant: c.string(), imageUrl: c.nullable(c.string()), quantity: c.number(), unitPrice: money, lineTotal: money, attribution: c.nullable(c.any()) })),
  subtotal: money, discount: money, storeCredit: money, deliveryFee: money, refundedTotal: money, refundable: money, deliveryCity: c.string(), deliveryState: c.string(), courier: c.nullable(c.string()), trackingNumber: c.nullable(c.string()),
  escrow: c.nullable(c.object({ status: c.string(), heldAmount: money, commission: money, sellerAmount: money, refunded: money, autoReleaseAt: c.nullable(c.string()), releasedAt: c.nullable(c.string()), refundedAt: c.nullable(c.string()) })),
  refunds: c.array(refund), timeline: c.array(c.object({ id: c.string(), kind: c.string(), summary: c.string(), actorKind: c.string(), actorName: c.string(), occurredAt: c.string() })),
});
const disputeStatuses = ["awaiting_seller", "under_review", "resolved_refunded", "resolved_released", "closed"];
const disputeSummaryFields = {
  id: c.string(), orderId: c.string(), orderNumber: c.string(), productName: c.string(), buyer: party, seller: party, store: c.object({ id: c.string(), name: c.nullable(c.string()) }), reason: c.string(),
  status: c.string(disputeStatuses), priority: c.string(["normal", "high", "urgent"]), escrowAmount: money, openedAt: c.string(), slaDueAt: c.nullable(c.string()), isSlaBreached: c.boolean(),
};
const disputeDetail = c.object({
  ...disputeSummaryFields, description: c.string(), evidenceUrls: c.array(c.string()), sellerResponse: c.nullable(c.string()), commissionBasisPoints: c.number(),
  escrow: c.object({ escrowId: c.string(), status: c.string(), amount: money, heldAmount: money, refundedAmount: money, releasedAmount: money, commission: money, processingFee: money, paymentReference: c.string(), deliveredAt: c.nullable(c.string()) }),
  resolution: c.nullable(c.object({ outcome: c.string(["release", "refund", "partial", "withdrawn"]), buyerRefund: money, sellerPayout: money, commission: money, note: c.string(), resolvedAt: c.nullable(c.string()), resolvedByStaffId: c.nullable(c.string()) })),
  messages: c.array(c.object({ id: c.string(), authorRole: c.string(["buyer", "seller", "support"]), authorName: c.string(), authorAvatarUrl: c.nullable(c.string()), text: c.string(), attachmentUrls: c.array(c.string()), createdAt: c.string() })),
  history: c.array(c.object({ status: c.string(), label: c.string(), occurredAt: c.string() })),
});

clearEveryMockRoute();
registerMoneyMockHandlers();
const database = readMockDatabase();
const admin = database.admins.find((candidate) => candidate.role === "SUPERADMIN");
if (!admin) throw new Error("the demo data has no superadmin");
const principal: MockPrincipal = { adminId: admin.id, name: admin.name, email: admin.email, role: admin.role, permissions: admin.permissions, sessionId: "ses_contract" };
let stepUpCounter = 0;
// Money actions consume their step-up token, so each call confirms afresh, as the console does.
function issueStepUpToken(): string {
  stepUpCounter += 1;
  const token = `stepup_contract_${stepUpCounter}`;
  database.stepUpTokens.set(token, { adminId: admin!.id, sessionId: principal.sessionId, expiresAtEpochMs: Date.now() + 600_000 });
  return token;
}

async function call(method: string, path: string, options: { readonly body?: unknown; readonly query?: string; readonly idempotencyKey?: string } = {}) {
  const headers = new Headers({ "x-step-up-token": issueStepUpToken() });
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

describe("money endpoints match the Go handlers", () => {
  it("coins list, detail, mark-reviewed and reverse", async () => {
    const list = await call("GET", "/admin/coins/transactions", { query: "status=pending_review&limit=2" });
    assert.deepEqual(validateAgainstContract(counted(coinTransaction, ["not_required", "pending_review", "reviewed", "reversed"]), list.body), []);
    const [first] = list.body.data as { id: string }[];
    if (!first) throw new Error("expected at least one row");
    const reviewed = await call("POST", `/admin/coins/transactions/${first.id}/mark-reviewed`, { body: { reason: "" } });
    assert.equal(reviewed.body.reviewStatus, "reviewed");
    assert.deepEqual(validateAgainstContract(c.object({ history: c.array(c.object({ action: c.string(), occurredAt: c.string(), staffId: c.nullable(c.string()), note: c.nullable(c.string()) })) }), reviewed.body), []);
    assert.equal((await call("POST", `/admin/coins/transactions/${first.id}/reverse`, { body: { reason: "Chargeback filed" } })).body.code, "IDEMPOTENCY_KEY_REQUIRED");
    const reversed = await call("POST", `/admin/coins/transactions/${first.id}/reverse`, { body: { reason: "Chargeback filed" }, idempotencyKey: "coin-reverse-0001" });
    assert.equal(reversed.body.reviewStatus, "reversed");
    assert.equal((await call("GET", "/admin/coins/transactions", { query: "status=PENDING_REVIEW" })).status, 400);
  });

  it("withdrawals list, detail and the hold decision", async () => {
    const list = await call("GET", "/admin/withdrawals", { query: "status=pending_review" });
    assert.deepEqual(validateAgainstContract(counted(withdrawal, withdrawalStatuses), list.body), []);
    const [first] = list.body.data as { id: string }[];
    if (!first) throw new Error("expected at least one row");
    const detail = await call("GET", `/admin/withdrawals/${first.id}`);
    assert.deepEqual(validateAgainstContract(c.object({ availableBalance: money, recentWithdrawals: c.array(c.object({ id: c.string(), amount: money, withdrawalStatus: c.string(withdrawalStatuses), createdAt: c.string() })) }), detail.body), []);
    assert.equal((await call("POST", `/admin/withdrawals/${first.id}/review`, { body: { decision: "hold", reason: "" }, idempotencyKey: "wd-hold-0001" })).status, 400);
    const held = await call("POST", `/admin/withdrawals/${first.id}/review`, { body: { decision: "hold", reason: "New bank account" }, idempotencyKey: "wd-hold-0002" });
    assert.equal(held.body.withdrawalStatus, "on_hold");
    assert.equal((await call("POST", `/admin/withdrawals/${first.id}/review`, { body: { decision: "hold", reason: "Again" }, idempotencyKey: "wd-hold-0003" })).status, 409);
    const approved = await call("POST", `/admin/withdrawals/${first.id}/review`, { body: { decision: "approve" }, idempotencyKey: "wd-approve-0001" });
    assert.equal(approved.body.withdrawalStatus, "queued");
  });

  it("ledger currencies, accounts and journal entries page by cursor", async () => {
    const currencies = await call("GET", "/admin/ledger/currencies");
    assert.deepEqual(validateAgainstContract(c.page(c.string()), currencies.body), []);
    const accounts = await call("GET", "/admin/ledger/accounts", { query: "currency=NGN&limit=3" });
    assert.deepEqual(validateAgainstContract(c.page(ledgerAccount), accounts.body), []);
    assert.ok(accounts.body.nextCursor);
    const [account] = accounts.body.data as { code: string }[];
    const entries = await call("GET", "/admin/ledger/journal-entries", { query: `currency=NGN&accountCode=${encodeURIComponent(account?.code ?? "")}` });
    assert.deepEqual(validateAgainstContract(c.page(journalEntry), entries.body), []);
    assert.ok((entries.body.data as { isBalanced: boolean }[]).every((entry) => entry.isBalanced));
  });

  it("orders, order by number and refunds", async () => {
    const orders = await call("GET", "/admin/orders", { query: "limit=5" });
    assert.deepEqual(validateAgainstContract(c.page(c.object(orderSummaryFields)), orders.body), []);
    const byNumber = await call("GET", "/admin/orders/ZM-24811");
    assert.deepEqual(validateAgainstContract(orderDetail, byNumber.body), []);
    const refunds = await call("GET", "/admin/refunds", { query: "source=manual" });
    assert.deepEqual(validateAgainstContract(c.page(refund), refunds.body), []);
    const issued = await call("POST", "/admin/refunds", { body: { orderId: byNumber.body.id, amount: { amountMinor: 1_000_00, currency: "NGN" }, reason: "Goodwill refund for late delivery" }, idempotencyKey: "refund-0001" });
    assert.equal(issued.status, 201);
    assert.deepEqual(validateAgainstContract(refund, issued.body), []);
  });

  it("lists cursor-paged, PII-minimized logistics summaries by shipment state", async () => {
    const response = await call("GET", "/admin/logistics/shipments", { query: "status=in_transit&limit=2" });
    assert.equal(response.status, 200);
    assert.deepEqual(validateAgainstContract(c.page(logisticsShipment), response.body), []);
    const rows = response.body.data as Record<string, unknown>[];
    assert.ok(rows.length > 0);
    assert.ok(rows.every((row) => row.status === "in_transit"));
    assert.equal(rows[0]?.trackingNumber, "TEST-TRACK-1234");
    assert.equal(rows[0]?.trackingUrl, "https://carrier.example/track/TEST-TRACK-1234");
    for (const row of rows) {
      for (const privateField of ["email", "phone", "pickupAddress", "destinationAddress", "payload"]) assert.equal(privateField in row, false);
    }
  });

  it("disputes staff view and the REFUND_PARTIAL resolve body", async () => {
    const list = await call("GET", "/admin/disputes", { query: "status=open" });
    assert.deepEqual(validateAgainstContract(counted(c.object(disputeSummaryFields), disputeStatuses), list.body), []);
    const open = (list.body.data as { id: string; escrowAmount: { amountMinor: number; currency: string } }[])[0];
    if (!open) throw new Error("expected an open dispute");
    const detail = await call("GET", `/admin/disputes/${open.id}`);
    assert.deepEqual(validateAgainstContract(disputeDetail, detail.body), []);
    const resolved = await call("POST", `/admin/disputes/${open.id}/resolve`, { body: { outcome: "REFUND_PARTIAL", refundAmount: { amountMinor: Math.floor(open.escrowAmount.amountMinor / 2), currency: open.escrowAmount.currency }, reason: "Split agreed by both sides" }, idempotencyKey: "dispute-0001" });
    assert.equal(resolved.status, 200);
    assert.equal((resolved.body.resolution as { outcome: string }).outcome, "partial");
  });
});

describe("undelivered orders under staff review", () => {
  const reviewRow = c.object({
    escrowId: c.string(), orderId: c.string(), orderReference: c.string(), buyerUserId: c.string(), sellerUserId: c.string(), storeId: c.string(), heldAmount: money,
    heldSince: c.string(), reviewSince: c.string(), shippedAt: c.nullable(c.string()), courierName: c.string(), trackingNumber: c.string(),
  });

  it("lists the queue and lets staff release to the seller or refund the buyer with a reason", async () => {
    const list = await call("GET", "/admin/escrows/undelivered-review");
    assert.deepEqual(validateAgainstContract(c.page(reviewRow), list.body), []);
    const [first, second] = list.body.data as { orderId: string }[];
    if (!first || !second) throw new Error("expected two orders under review");
    assert.equal((await call("POST", `/admin/orders/${first.orderId}/escrow/release`, { body: { reason: "" }, idempotencyKey: "review-0001" })).status, 400);
    assert.equal((await call("POST", `/admin/orders/${first.orderId}/escrow/release`, { body: { reason: "Seller sent proof of delivery" } })).body.code, "IDEMPOTENCY_KEY_REQUIRED");
    const released = await call("POST", `/admin/orders/${first.orderId}/escrow/release`, { body: { reason: "Seller sent proof of delivery" }, idempotencyKey: "review-0002" });
    assert.equal(released.body.status, "released");
    const refunded = await call("POST", `/admin/orders/${second.orderId}/escrow/refund`, { body: { reason: "Seller never shipped" }, idempotencyKey: "review-0003" });
    assert.equal(refunded.body.status, "refunded");
    const after = (await call("GET", "/admin/escrows/undelivered-review")).body.data as { orderId: string }[];
    assert.ok(after.every((row) => row.orderId !== first.orderId && row.orderId !== second.orderId));
    assert.equal((await call("POST", `/admin/orders/${first.orderId}/escrow/release`, { body: { reason: "Again" }, idempotencyKey: "review-0004" })).status, 409);
  });

  it("needs disputes:resolve and a single-use step-up", () => {
    assert.deepEqual(findApiAccessRequirement("/admin/escrows/undelivered-review"), { kind: "anyOf", permissions: ["disputes:resolve"] });
    assert.equal(doesApiCallRequireStepUp("POST", "/admin/orders/abc/escrow/release"), true);
    assert.equal(doesApiCallRequireStepUp("POST", "/admin/orders/abc/escrow/refund"), true);
  });
});

describe("BFF access rules for money paths", () => {
  it("guards the new paths and asks for step-up where the Go routes do", () => {
    assert.deepEqual(findApiAccessRequirement("/admin/logistics/shipments"), { kind: "anyOf", permissions: ["logistics:read"] });
    assert.deepEqual(findApiAccessRequirement("/admin/withdrawals/abc"), { kind: "anyOf", permissions: ["payouts:approve"] });
    assert.deepEqual(findApiAccessRequirement("/admin/coins/transactions"), { kind: "anyOf", permissions: ["coins:review"] });
    assert.deepEqual(findApiAccessRequirement("/admin/ledger/journal-entries"), { kind: "anyOf", permissions: ["ledger:read"] });
    assert.equal(doesApiCallRequireStepUp("POST", "/admin/withdrawals/abc/review"), true);
    assert.equal(doesApiCallRequireStepUp("POST", "/admin/coins/transactions/abc/reverse"), true);
    assert.equal(doesApiCallRequireStepUp("POST", "/admin/coins/transactions/abc/mark-reviewed"), false);
    assert.equal(doesApiCallRequireStepUp("PUT", "/admin/config/appStore.fees"), true);
    assert.deepEqual(findApiAccessRequirement("/admin/finance/overview"), { kind: "anyOf", permissions: ["finance:reports"] });
    assert.equal(doesApiCallRequireStepUp("POST", "/admin/finance/reports/export"), true);
  });

  it("serves finance overview, issues, lookup, and audited CSV exports", async () => {
    const overview = await call("GET", "/admin/finance/overview", { query: "range=7d" });
    assert.equal(overview.status, 200);
    assert.deepEqual(validateAgainstContract(c.object({
      generatedAt: c.string(), range: c.string(), gmvByCurrency: c.array(money), escrowHeldByCurrency: c.array(money),
      payoutsPendingByCurrency: c.array(money), disputesOpenCount: c.number(), stuckEscrowsCount: c.number(),
    }), overview.body), []);

    const issues = await call("GET", "/admin/finance/issues");
    assert.equal(issues.status, 200);
    assert.ok(Array.isArray(issues.body.data));

    const lookupMiss = await call("GET", "/admin/finance/lookup", { query: "ref=missing-ref" });
    assert.equal(lookupMiss.status, 200);
    assert.equal(lookupMiss.body.found, false);
    assert.match(String(lookupMiss.body.message), /checked 5 stores/);

    const lookupHit = await call("GET", "/admin/finance/lookup", { query: "ref=ZM-24811" });
    assert.equal(lookupHit.status, 200);
    assert.equal(lookupHit.body.found, true);

    assert.equal((await call("POST", "/admin/finance/reports/export", { body: { reportType: "overview", reason: "ok" } })).status, 400);
    const exported = await call("POST", "/admin/finance/reports/export", { body: { reportType: "overview", reason: "Daily close reconciliation" }, idempotencyKey: "fin-exp-1" });
    assert.equal(exported.status, 200);
  });
});
