import { findMockPlatformUser, readMockAreaStore } from "@/mocks/mockDatabase.mock";
import { recordMockAuditEntry } from "@/mocks/mockAudit.mock";
import { requireMockPermission, requireMockSingleUseStepUp } from "@/mocks/mockGuards.mock";
import { MockHttpError, createMockId, failConflict, failNotFound, failValidation, paginateByCursor, readIsoNow, readJsonObjectBody, readRequiredReason, readRequiredTrimmedString, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockRoute, type MockRequest, type MockResponse } from "@/mocks/mockRouter.mock";
import { buildDemoAdCashbackSettings, buildDemoAdCredits, type MockAdCashbackRecord, type MockAdCreditRecord } from "@/mocks/seed/trustAdCredits.mock";
import type { AdCashbackSetting, AdCreditGrant, AdCreditSource, AdCreditStatus } from "@/types/adCredit.type";
import { isCashbackPercentAllowed } from "@/utils/adCredit.util";

import { requireIdempotencyKeyHeader } from "../money/moneyStore.mock";

interface MockAdCreditStore {
  readonly credits: MockAdCreditRecord[];
  readonly cashback: MockAdCashbackRecord[];
  readonly replays: Map<string, { readonly signature: string; readonly response: MockResponse }>;
}

const creditStatuses: readonly AdCreditStatus[] = ["active", "expired", "revoked", "spent"];
const creditSources: readonly AdCreditSource[] = ["admin_issued", "cashback", "premium_free_boost", "boost_refund", "legacy"];

function readAdCreditStore(): MockAdCreditStore {
  return readMockAreaStore("adCredits", () => ({ credits: buildDemoAdCredits(), cashback: buildDemoAdCashbackSettings(), replays: new Map() }));
}

function readUsernameOrId(userId: string): string {
  return findMockPlatformUser(userId)?.username ?? userId;
}

function presentAdCredit(record: MockAdCreditRecord): AdCreditGrant {
  return {
    id: record.id, userId: record.userId, username: readUsernameOrId(record.userId), accountId: record.accountId, source: record.source,
    amount: { amountMinor: record.amountMinor, currency: record.currency }, remaining: { amountMinor: record.remainingMinor, currency: record.currency }, expiresAt: record.expiresAt,
    reason: record.reason, status: record.status, issuedBy: record.issuedBy, createdAt: record.createdAt, revokedAt: record.revokedAt,
    revokedAmount: record.revokedMinor === null ? null : { amountMinor: record.revokedMinor, currency: record.currency },
  };
}

function presentCashback(record: MockAdCashbackRecord): AdCashbackSetting {
  return { userId: record.userId, username: readUsernameOrId(record.userId), enabled: record.enabled, percent: record.percent, reason: record.reason, updatedAt: record.updatedAt, updatedBy: record.updatedBy };
}

function runOncePerIdempotencyKey(request: MockRequest, scope: string, perform: () => MockResponse): MockResponse {
  requireIdempotencyKeyHeader(request.headers);
  const key = `${request.principal?.adminId}:${scope}:${request.headers.get("idempotency-key")}`;
  const signature = JSON.stringify([request.path, request.jsonBody]);
  const store = readAdCreditStore();
  const replay = store.replays.get(key);
  if (replay) {
    if (replay.signature !== signature) throw new MockHttpError(409, "IDEMPOTENCY_KEY_REUSED", "That Idempotency-Key was used with a different request.");
    return { ...replay.response, headers: { "idempotent-replayed": "true" } };
  }
  const response = perform();
  store.replays.set(key, { signature, response });
  return response;
}

function readStaffReference(request: MockRequest) {
  return request.principal ? { id: request.principal.adminId, name: request.principal.name } : null;
}

function readIssueAmount(body: Record<string, unknown>): { readonly amountMinor: number; readonly currency: string } {
  const amount = body.amount as { amountMinor?: unknown; currency?: unknown } | undefined;
  if (!amount || typeof amount.amountMinor !== "number" || !Number.isInteger(amount.amountMinor) || amount.amountMinor <= 0) failValidation("amount.amountMinor", "must be a whole number above zero");
  if (typeof amount.currency !== "string" || !/^[A-Z]{3}$/.test(amount.currency)) failValidation("amount.currency", "must be a three-letter currency code");
  return { amountMinor: amount.amountMinor as number, currency: amount.currency as string };
}

function readIssueExpiry(body: Record<string, unknown>): string | null {
  if (body.expiresAt === null || body.expiresAt === undefined) return null;
  if (typeof body.expiresAt !== "string" || Number.isNaN(Date.parse(body.expiresAt)) || Date.parse(body.expiresAt) <= Date.now()) failValidation("expiresAt", "must be a future date or null");
  return body.expiresAt as string;
}

export function registerAdCreditMockHandlers(): void {
  registerMockRoute("GET", "/admin/ads/credits", (request) => {
    requireMockPermission(request, "advertisers:manage", "ledger:read");
    const status = request.query.get("status");
    const source = request.query.get("source");
    const userId = request.query.get("userId");
    if (status && !(creditStatuses as readonly string[]).includes(status)) failValidation("status", `must be one of ${creditStatuses.join(", ")}`);
    if (source && !(creditSources as readonly string[]).includes(source)) failValidation("source", `must be one of ${creditSources.join(", ")}`);
    const credits = readAdCreditStore()
      .credits.filter((credit) => (!status || credit.status === status) && (!source || credit.source === source) && (!userId || credit.userId === userId))
      .sort((first, second) => second.createdAt.localeCompare(first.createdAt))
      .map(presentAdCredit);
    return respondWithJson(200, paginateByCursor(credits, request));
  });

  registerMockRoute("POST", "/admin/ads/credits", (request) => {
    requireMockPermission(request, "advertisers:manage");
    requireMockSingleUseStepUp(request);
    return runOncePerIdempotencyKey(request, "issue", () => {
      const body = readJsonObjectBody(request);
      const reason = readRequiredReason(body);
      const userId = readRequiredTrimmedString(body, "userId", 80);
      if (!findMockPlatformUser(userId)) failNotFound("User");
      const amount = readIssueAmount(body);
      const record: MockAdCreditRecord = {
        id: createMockId("adc"), userId, accountId: `ada_${userId}_${amount.currency.toLowerCase()}`, source: "admin_issued", amountMinor: amount.amountMinor, remainingMinor: amount.amountMinor, currency: amount.currency,
        expiresAt: readIssueExpiry(body), reason, status: "active", issuedBy: readStaffReference(request), createdAt: readIsoNow(), revokedAt: null, revokedMinor: null,
      };
      readAdCreditStore().credits.unshift(record);
      recordMockAuditEntry(request, { action: "ad_credit.issued", area: "ads", target: { type: "adCredit", id: record.id, label: readUsernameOrId(userId) }, reason, before: null, after: presentAdCredit(record) });
      return respondWithJson(201, presentAdCredit(record));
    });
  });

  registerMockRoute("POST", "/admin/ads/credits/:creditId/revoke", (request) => {
    requireMockPermission(request, "advertisers:manage");
    requireMockSingleUseStepUp(request);
    return runOncePerIdempotencyKey(request, "revoke", () => {
      const reason = readRequiredReason(readJsonObjectBody(request));
      const record = readAdCreditStore().credits.find((credit) => credit.id === request.params.creditId);
      if (!record) failNotFound("Ad credit");
      if (record.status !== "active" || record.remainingMinor <= 0) failConflict("CREDIT_NOT_REVOCABLE", "Nothing unspent is left on this credit.");
      const before = presentAdCredit(record);
      record.revokedMinor = record.remainingMinor;
      record.remainingMinor = 0;
      record.status = "revoked";
      record.revokedAt = readIsoNow();
      recordMockAuditEntry(request, { action: "ad_credit.revoked", area: "ads", target: { type: "adCredit", id: record.id, label: readUsernameOrId(record.userId) }, reason, before, after: presentAdCredit(record) });
      return respondWithJson(200, presentAdCredit(record));
    });
  });

  registerMockRoute("GET", "/admin/ads/cashback", (request) => {
    requireMockPermission(request, "advertisers:manage", "ledger:read");
    const settings = [...readAdCreditStore().cashback].sort((first, second) => second.updatedAt.localeCompare(first.updatedAt)).map(presentCashback);
    return respondWithJson(200, paginateByCursor(settings, request));
  });

  registerMockRoute("PUT", "/admin/ads/cashback/:userId", (request) => {
    requireMockPermission(request, "advertisers:manage");
    requireMockSingleUseStepUp(request);
    return runOncePerIdempotencyKey(request, "cashback", () => {
      const body = readJsonObjectBody(request);
      const reason = readRequiredReason(body);
      const userId = request.params.userId ?? "";
      if (!findMockPlatformUser(userId)) failNotFound("User");
      if (typeof body.enabled !== "boolean") failValidation("enabled", "must be true or false");
      const percent = body.percent === undefined ? 10 : body.percent;
      if (typeof percent !== "number" || !isCashbackPercentAllowed(percent)) failValidation("percent", "must be a whole number from 1 to 50");
      const store = readAdCreditStore();
      const existing = store.cashback.find((setting) => setting.userId === userId);
      const before = existing ? presentCashback(existing) : null;
      const record: MockAdCashbackRecord = existing ?? { userId, enabled: false, percent: 10, reason, updatedAt: readIsoNow(), updatedBy: null };
      record.enabled = body.enabled as boolean;
      record.percent = percent as number;
      record.reason = reason;
      record.updatedAt = readIsoNow();
      record.updatedBy = readStaffReference(request);
      if (!existing) store.cashback.push(record);
      recordMockAuditEntry(request, { action: "ad_cashback.updated", area: "ads", target: { type: "adCashback", id: userId, label: readUsernameOrId(userId) }, reason, before, after: presentCashback(record) });
      return respondWithJson(200, presentCashback(record));
    });
  });
}
