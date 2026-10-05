import { randomBytes, timingSafeEqual } from "node:crypto";

import { appendMockAuditLogEntry, readMockDatabase, readMockStoreDataset } from "@/mocks/mockDatabase.mock";
import { MockHttpError, readJsonObjectBody, respondWithError, respondWithJson, respondWithNoContent, requireMockStorePrincipal } from "@/mocks/mockResponses.mock";
import { registerMockRoute, type MockRequest } from "@/mocks/mockRouter.mock";
import { findMockMembershipForUserAndStore } from "@/mocks/mockStoreMembership.mock";
import { doesPasswordMatchOverrideForUser, registerPasswordResetMockHandlers } from "@/mocks/handlers/passwordReset.mock";
import { demoAccountPassword } from "@/mocks/seed/demoPeople.mock";
import { convertSubscriptionPlanToGoldBadgeTier } from "@/mocks/mockStoreMembership.mock";
import type { SellerAccess } from "@/types/sellerAccess.type";

const accessTokenLifetimeInSeconds = 15 * 60;

function issueMockTokenPair(userId: string, sessionId: string) {
  const database = readMockDatabase();
  const accessToken = `mock_at_${randomBytes(24).toString("base64url")}`;
  const refreshToken = `mock_rt_${randomBytes(32).toString("base64url")}`;
  database.accessTokens.set(accessToken, { userId, sessionId, expiresAtEpochMs: Date.now() + accessTokenLifetimeInSeconds * 1000 });
  database.apiSessions.set(refreshToken, { sessionId, userId, refreshToken, revoked: false });
  return { accessToken, refreshToken, expiresIn: accessTokenLifetimeInSeconds, tokenType: "Bearer" as const };
}

function convertMockUserToCurrentUser(userId: string) {
  const user = readMockDatabase().users.find((candidate) => candidate.id === userId);
  if (!user) throw new MockHttpError(404, "USER_NOT_FOUND", "Account not found.");
  return { id: user.id, email: user.email, phone: user.phone, username: user.username, name: user.name, avatarUrl: user.avatarUrl, roles: ["user"] };
}

function isDemoPasswordCorrect(candidatePassword: string): boolean {
  const expected = Buffer.from(demoAccountPassword);
  const received = Buffer.from(candidatePassword);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function buildSellerAccessForUser(userId: string, storeId: string | null = null): SellerAccess {
  const database = readMockDatabase();
  const membership = findMockMembershipForUserAndStore(userId, storeId);
  const gateStore = membership ? database.gateStores.find((store) => store.storeId === membership.storeId) : undefined;
  if (!membership || !gateStore) {
    return { storeId: null, storeName: null, verification: { status: "unverified", color: "GOLD", tier: null, badgeVisible: false }, subscription: null, entitlements: null, role: null, permissions: null };
  }
  const subscription = gateStore.subscription.subscription;
  const isSubscriptionActive = subscription?.status === "active" || subscription?.status === "trialing";
  const plan = database.subscriptionPlans.find((candidate) => candidate.id === gateStore.subscription.planId);
  const isGoldVerified = gateStore.verificationStatus === "verified" && isSubscriptionActive;
  return {
    storeId: gateStore.storeId,
    storeName: gateStore.storeName,
    verification: { status: gateStore.verificationStatus, color: "GOLD", tier: isGoldVerified ? convertSubscriptionPlanToGoldBadgeTier(subscription?.plan) : null, badgeVisible: isGoldVerified },
    subscription,
    entitlements: isSubscriptionActive && plan ? plan.entitlements : null,
    role: membership.role,
    permissions: readMockStoreDataset(membership.storeId).staff.find((staff) => staff.id === membership.staffId)?.permissions ?? null,
  };
}

function readGateStoreForRequest(request: MockRequest) {
  const principal = requireMockStorePrincipal(request);
  const gateStore = readMockDatabase().gateStores.find((store) => store.storeId === principal.storeId);
  if (!gateStore) throw new MockHttpError(404, "STORE_NOT_FOUND", "Store not found.");
  return { principal, gateStore };
}

export function registerAccessAndAuthMockHandlers(): void {
  registerPasswordResetMockHandlers();
  registerMockRoute("POST", "/auth/login", (request) => {
    const body = readJsonObjectBody(request);
    const identifier = typeof body.identifier === "string" ? body.identifier.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const user = readMockDatabase().users.find((candidate) => candidate.email === identifier || candidate.username === identifier);
    const overrideMatch = user ? doesPasswordMatchOverrideForUser(user.id, password) : null;
    if (!user || !(overrideMatch ?? isDemoPasswordCorrect(password))) return respondWithError(401, "INVALID_CREDENTIALS", "That email, username or password is not right.");
    const tokens = issueMockTokenPair(user.id, randomBytes(12).toString("hex"));
    return respondWithJson(200, { ...tokens, user: convertMockUserToCurrentUser(user.id), isNewUser: false });
  }, { public: true });

  registerMockRoute("POST", "/auth/refresh", (request) => {
    const database = readMockDatabase();
    const refreshToken = String(readJsonObjectBody(request).refreshToken ?? "");
    const reusedSessionId = database.usedRefreshTokens.get(refreshToken);
    if (reusedSessionId) {
      for (const session of database.apiSessions.values()) if (session.sessionId === reusedSessionId) session.revoked = true;
      return respondWithError(401, "REFRESH_TOKEN_REUSED", "This session was signed out for your safety.");
    }
    const session = database.apiSessions.get(refreshToken);
    if (!session || session.revoked) return respondWithError(401, "INVALID_REFRESH_TOKEN", "Sign in again.");
    database.apiSessions.delete(refreshToken);
    database.usedRefreshTokens.set(refreshToken, session.sessionId);
    return respondWithJson(200, issueMockTokenPair(session.userId, session.sessionId));
  }, { public: true });

  registerMockRoute("POST", "/auth/logout", (request) => {
    const database = readMockDatabase();
    const refreshToken = String((request.jsonBody as { refreshToken?: unknown } | undefined)?.refreshToken ?? "");
    const session = database.apiSessions.get(refreshToken);
    if (session) session.revoked = true;
    return respondWithNoContent();
  }, { public: true });

  registerMockRoute("GET", "/users/me", (request) => respondWithJson(200, convertMockUserToCurrentUser(request.principal?.userId ?? "")));

  registerMockRoute("GET", "/seller/access", (request) => respondWithJson(200, buildSellerAccessForUser(request.principal?.userId ?? "", request.principal?.storeId ?? null)));

  registerMockRoute("GET", "/seller/verification", (request) => {
    const { gateStore } = readGateStoreForRequest(request);
    const documentStatus = gateStore.verificationStatus === "verified" ? "approved" : gateStore.verificationStatus === "revoked" || gateStore.verificationStatus === "suspended" ? "rejected" : "in_review";
    return respondWithJson(200, {
      status: gateStore.verificationStatus,
      note: gateStore.verificationNote,
      submittedAt: "2026-09-02T10:14:00.000Z",
      documents: [
        { kind: "cac_certificate", label: "CAC certificate", status: gateStore.verificationStatus === "pending" ? "in_review" : documentStatus },
        { kind: "identity", label: "Government ID", status: documentStatus },
        { kind: "address_proof", label: "Proof of address", status: documentStatus },
      ],
    });
  });

  registerMockRoute("GET", "/seller/subscription/plans", () => respondWithJson(200, { data: readMockDatabase().subscriptionPlans, nextCursor: null }), { public: true });

  registerMockRoute("GET", "/seller/subscription", (request) => respondWithJson(200, readGateStoreForRequest(request).gateStore.subscription));

  registerMockRoute("POST", "/seller/subscription/checkout", (request) => {
    const { gateStore } = readGateStoreForRequest(request);
    const planId = String(readJsonObjectBody(request).planId ?? "");
    if (!readMockDatabase().subscriptionPlans.some((plan) => plan.id === planId)) throw new MockHttpError(404, "PLAN_NOT_FOUND", "Pick one of the listed plans.");
    const reference = `SUB_${randomBytes(8).toString("hex").toUpperCase()}`;
    readMockDatabase().pendingSubscriptionCheckouts.set(reference, { storeId: gateStore.storeId, planId });
    return respondWithJson(201, { authorizationUrl: `/billing-checkout/demo?reference=${reference}`, reference, provider: "paystack" });
  });

  registerMockRoute("POST", "/seller/subscription/verify", (request) => {
    const { gateStore } = readGateStoreForRequest(request);
    const reference = String(readJsonObjectBody(request).reference ?? "");
    const database = readMockDatabase();
    const pending = database.pendingSubscriptionCheckouts.get(reference);
    if (!pending || pending.storeId !== gateStore.storeId) throw new MockHttpError(404, "PAYMENT_NOT_FOUND", "We could not find that payment. If you were charged, contact support with the reference.");
    const plan = database.subscriptionPlans.find((candidate) => candidate.id === pending.planId);
    database.pendingSubscriptionCheckouts.delete(reference);
    const periodEnd = new Date(Date.now() + (plan?.interval === "year" ? 365 : 30) * 86_400_000).toISOString();
    if (!plan) throw new MockHttpError(404, "PLAN_NOT_FOUND", "That plan is no longer available.");
    gateStore.subscription = {
      ...gateStore.subscription,
      subscription: { status: "active", plan: plan.tier, currentPeriodEnd: periodEnd },
      planId: plan.id,
      cancelAtPeriodEnd: false,
      provider: "paystack",
      paymentMethodSummary: "Mastercard •••• 5199",
      invoices: [{ id: `inv_${reference}`, number: `ZD-INV-${reference.slice(4, 10)}`, amount: plan.price, status: "paid", periodStart: new Date().toISOString(), periodEnd, paidAt: new Date().toISOString() }, ...gateStore.subscription.invoices],
    };
    return respondWithJson(200, gateStore.subscription);
  });

  registerMockRoute("POST", "/seller/subscription/cancel", (request) => {
    const { gateStore, principal } = readGateStoreForRequest(request);
    gateStore.subscription = { ...gateStore.subscription, cancelAtPeriodEnd: true };
    appendMockAuditLogEntry({ actor: { id: principal.staffId ?? principal.userId, name: principal.actorName, role: principal.role ?? "owner" }, action: "subscription.cancelled", targetType: "subscription", targetId: null, summary: "Set the subscription to cancel at the end of the period" });
    return respondWithJson(200, gateStore.subscription);
  });

  registerMockRoute("POST", "/seller/subscription/resume", (request) => {
    const { gateStore } = readGateStoreForRequest(request);
    gateStore.subscription = { ...gateStore.subscription, cancelAtPeriodEnd: false };
    return respondWithJson(200, gateStore.subscription);
  });


}
