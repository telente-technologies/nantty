import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import { appendMockAuditLogEntry, readMockDatabase } from "@/mocks/mockDatabase.mock";
import { MockHttpError, readJsonObjectBody, respondWithError, respondWithJson, respondWithNoContent, requireMockStorePrincipal } from "@/mocks/mockResponses.mock";
import { registerMockRoute, type MockRequest } from "@/mocks/mockRouter.mock";
import { demoAccountPassword, type MockStaffRecord } from "@/mocks/seed/demoPeople.mock";
import type { SellerAccess } from "@/types/sellerAccess.type";

const accessTokenLifetimeInSeconds = 15 * 60;
const maximumFailedPinAttempts = 5;
const pinLockDurationInMilliseconds = 15 * 60_000;

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

export function buildSellerAccessForUser(userId: string): SellerAccess {
  const database = readMockDatabase();
  const membership = database.memberships.find((candidate) => candidate.userId === userId);
  const gateStore = membership ? database.gateStores.find((store) => store.storeId === membership.storeId) : undefined;
  if (!membership || !gateStore) {
    return { storeId: null, storeName: null, verification: { status: "unverified", color: "GOLD", tier: null, badgeVisible: false }, subscription: null, entitlements: null, role: null };
  }
  const subscription = gateStore.subscription.subscription;
  const isSubscriptionActive = subscription?.status === "active" || subscription?.status === "trialing";
  const plan = database.subscriptionPlans.find((candidate) => candidate.id === gateStore.subscription.planId);
  const isGoldVerified = gateStore.verificationStatus === "verified" && isSubscriptionActive;
  return {
    storeId: gateStore.storeId,
    storeName: gateStore.storeName,
    verification: { status: gateStore.verificationStatus, color: "GOLD", tier: isGoldVerified ? subscription?.plan ?? null : null, badgeVisible: isGoldVerified },
    subscription,
    entitlements: isSubscriptionActive && plan ? plan.entitlements : null,
    role: membership.role,
  };
}

function readGateStoreForRequest(request: MockRequest) {
  const principal = requireMockStorePrincipal(request);
  const gateStore = readMockDatabase().gateStores.find((store) => store.storeId === principal.storeId);
  if (!gateStore) throw new MockHttpError(404, "STORE_NOT_FOUND", "Store not found.");
  return { principal, gateStore };
}

function verifyPinAgainstStaffRecord(staff: MockStaffRecord, pin: string): boolean {
  if (!staff.pinHash) return false;
  const [salt = "", storedHashHex = ""] = staff.pinHash.split(":");
  const candidateHash = scryptSync(pin, salt, 32);
  const storedHash = Buffer.from(storedHashHex, "hex");
  return storedHash.length === candidateHash.length && timingSafeEqual(storedHash, candidateHash);
}

export function checkStaffPinWithLockout(staffId: string, pin: string, storeId: string): MockStaffRecord {
  const database = readMockDatabase();
  const staffIndex = database.staff.findIndex((candidate) => candidate.id === staffId && candidate.status === "active");
  const staff = database.staff[staffIndex];
  if (!staff || storeId !== "store_ife_lifestyle") throw new MockHttpError(401, "PIN_INCORRECT", "That PIN is not right.");
  if (staff.pinLockedUntil && new Date(staff.pinLockedUntil).getTime() > Date.now()) {
    throw new MockHttpError(423, "PIN_LOCKED", `Too many wrong PINs. Try again after ${new Date(staff.pinLockedUntil).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })} or ask a manager to unlock.`);
  }
  if (!/^\d{4,6}$/.test(pin) || !verifyPinAgainstStaffRecord(staff, pin)) {
    const failedPinAttempts = staff.failedPinAttempts + 1;
    const isNowLocked = failedPinAttempts >= maximumFailedPinAttempts;
    database.staff[staffIndex] = { ...staff, failedPinAttempts: isNowLocked ? 0 : failedPinAttempts, pinLockedUntil: isNowLocked ? new Date(Date.now() + pinLockDurationInMilliseconds).toISOString() : null };
    const attemptsLeft = maximumFailedPinAttempts - failedPinAttempts;
    throw new MockHttpError(isNowLocked ? 423 : 401, isNowLocked ? "PIN_LOCKED" : "PIN_INCORRECT", isNowLocked ? "Too many wrong PINs. This PIN is locked for 15 minutes." : `That PIN is not right. ${attemptsLeft} ${attemptsLeft === 1 ? "try" : "tries"} left.`);
  }
  database.staff[staffIndex] = { ...staff, failedPinAttempts: 0, pinLockedUntil: null, lastActiveAt: new Date().toISOString() };
  return staff;
}

export function registerAccessAndAuthMockHandlers(): void {
  registerMockRoute("POST", "/auth/login", (request) => {
    const body = readJsonObjectBody(request);
    const identifier = typeof body.identifier === "string" ? body.identifier.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const user = readMockDatabase().users.find((candidate) => candidate.email === identifier || candidate.username === identifier || candidate.phone === identifier);
    if (!user || !isDemoPasswordCorrect(password)) return respondWithError(401, "INVALID_CREDENTIALS", "That email, phone or password is not right.");
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

  registerMockRoute("GET", "/seller/access", (request) => respondWithJson(200, buildSellerAccessForUser(request.principal?.userId ?? "")));

  registerMockRoute("GET", "/seller/verification", (request) => {
    const { gateStore } = readGateStoreForRequest(request);
    const documentStatus = gateStore.verificationStatus === "verified" ? "approved" : gateStore.verificationStatus === "revoked" || gateStore.verificationStatus === "suspended" ? "rejected" : "in_review";
    return respondWithJson(200, {
      status: gateStore.verificationStatus,
      note: gateStore.verificationNote,
      submittedAt: "2026-09-02T10:14:00.000Z",
      documents: [
        { kind: "government_id", label: "Owner's government ID", status: documentStatus },
        { kind: "cac_certificate", label: "CAC certificate", status: gateStore.verificationStatus === "pending" ? "in_review" : documentStatus },
        { kind: "proof_of_address", label: "Proof of business address", status: documentStatus },
        { kind: "bank_account", label: "Payout bank account", status: "approved" },
      ],
    });
  });

  registerMockRoute("GET", "/seller/subscription/plans", () => respondWithJson(200, { data: readMockDatabase().subscriptionPlans, nextCursor: null }));

  registerMockRoute("GET", "/seller/subscription", (request) => respondWithJson(200, readGateStoreForRequest(request).gateStore.subscription));

  registerMockRoute("POST", "/seller/subscription/checkout", (request) => {
    const { gateStore } = readGateStoreForRequest(request);
    const planId = String(readJsonObjectBody(request).planId ?? "");
    if (gateStore.verificationStatus !== "verified") throw new MockHttpError(409, "STORE_NOT_VERIFIED", "Your store must be verified before you subscribe.");
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

  registerMockRoute("GET", "/seller/staff/pin-roster", (request) => {
    requireMockStorePrincipal(request);
    const locationId = request.query.get("locationId");
    const roster = readMockDatabase().staff
      .filter((staff) => staff.status === "active" && staff.hasPosPin && (!locationId || staff.locationIds.includes(locationId)))
      .map((staff) => ({ staffId: staff.id, name: staff.name, role: staff.role, locked: Boolean(staff.pinLockedUntil && new Date(staff.pinLockedUntil).getTime() > Date.now()) }));
    return respondWithJson(200, { data: roster, nextCursor: null });
  });

  registerMockRoute("POST", "/seller/staff/pin-sessions", (request) => {
    const principal = requireMockStorePrincipal(request);
    const body = readJsonObjectBody(request);
    const staff = checkStaffPinWithLockout(String(body.staffId ?? ""), String(body.pin ?? ""), principal.storeId);
    const operatorToken = `mock_op_${randomBytes(24).toString("base64url")}`;
    const expiresAtEpochMs = Date.now() + 12 * 3_600_000;
    readMockDatabase().operatorSessions.set(operatorToken, { staffId: staff.id, storeId: principal.storeId, expiresAtEpochMs });
    return respondWithJson(201, { operatorToken, operator: { staffId: staff.id, name: staff.name, role: staff.role }, expiresAt: new Date(expiresAtEpochMs).toISOString() });
  });

  registerMockRoute("DELETE", "/seller/staff/pin-sessions/current", (request) => {
    const operatorToken = request.headers.get("x-seller-operator");
    if (operatorToken) readMockDatabase().operatorSessions.delete(operatorToken);
    return respondWithNoContent();
  });
}
