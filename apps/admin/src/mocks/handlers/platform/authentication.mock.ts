import { readMockDatabase } from "@/mocks/mockDatabase.mock";
import {
  areStringsEqualInConstantTime,
  createBase32Secret,
  createRandomMockToken,
  createRecoveryCodes,
  isMockTotpCodeValid,
  presentSignedInAdmin,
  revokeMockAdminSession,
  startMockAdminSession,
  issueMockTokenPairForSession,
} from "@/mocks/mockAuthTokens.mock";
import { requireMockPrincipal } from "@/mocks/mockGuards.mock";
import { MockHttpError, readJsonObjectBody, respondWithError, respondWithJson, respondWithNoContent } from "@/mocks/mockResponses.mock";
import { registerMockRoute, type MockRequest } from "@/mocks/mockRouter.mock";
import { demoAdminPassword, type MockAdminRecord } from "@/mocks/seed/demoAdmins.mock";

const maximumFailedLoginAttempts = 5;
const lockoutDurationInMilliseconds = 15 * 60_000;
const mfaTokenLifetimeInMilliseconds = 5 * 60_000;
const stepUpLifetimeInSeconds = 300;

function readPendingMfaAdmin(request: MockRequest): { admin: MockAdminRecord; mfaToken: string } {
  const database = readMockDatabase();
  const body = readJsonObjectBody(request);
  const mfaToken = String(body.challengeToken ?? body.mfaToken ?? "");
  const record = database.mfaTokens.get(mfaToken);
  if (!record || record.expiresAtEpochMs < Date.now()) throw new MockHttpError(401, "MFA_CHALLENGE_EXPIRED", "Your sign-in step expired. Enter your password again.");
  const admin = database.admins.find((candidate) => candidate.id === record.adminId);
  if (!admin || admin.status !== "ACTIVE") throw new MockHttpError(401, "MFA_CHALLENGE_EXPIRED", "Your sign-in step expired. Enter your password again.");
  return { admin, mfaToken };
}

function registerFailedMfaAttempt(mfaToken: string): never {
  const record = readMockDatabase().mfaTokens.get(mfaToken);
  if (record) {
    record.failedAttempts += 1;
    if (record.failedAttempts >= 5) readMockDatabase().mfaTokens.delete(mfaToken);
  }
  throw new MockHttpError(401, "INVALID_MFA_CODE", record && record.failedAttempts < 5 ? "That code did not work. Try the newest code." : "Too many wrong codes. Enter your password again.");
}

function completeMfaSignIn(admin: MockAdminRecord, mfaToken: string, extra: Record<string, unknown> = {}) {
  const database = readMockDatabase();
  const record = database.mfaTokens.get(mfaToken);
  database.mfaTokens.delete(mfaToken);
  return respondWithJson(200, { ...startMockAdminSession(admin, record?.ipAddress ?? "127.0.0.1", record?.userAgent ?? "unknown"), staff: presentSignedInAdmin(admin), ...extra });
}

export function registerAuthenticationMockHandlers(): void {
  registerMockRoute("POST", "/admin/auth/login", (request) => {
    const body = readJsonObjectBody(request);
    const email = String(body.email ?? "").trim().toLowerCase();
    const admin = readMockDatabase().admins.find((candidate) => candidate.email === email);
    if (admin && admin.lockedUntilEpochMs > Date.now()) {
      return respondWithError(423, "ACCOUNT_LOCKED", "This account is locked after too many failed attempts. Try again in 15 minutes or ask a superadmin.", [], { lockedUntil: new Date(admin.lockedUntilEpochMs).toISOString() });
    }
    if (!admin || !areStringsEqualInConstantTime(demoAdminPassword, String(body.password ?? ""))) {
      if (admin) {
        admin.failedLoginAttempts += 1;
        if (admin.failedLoginAttempts >= maximumFailedLoginAttempts) {
          admin.lockedUntilEpochMs = Date.now() + lockoutDurationInMilliseconds;
          admin.failedLoginAttempts = 0;
        }
      }
      return respondWithError(401, "INVALID_CREDENTIALS", "That email and password do not match an admin account.");
    }
    if (admin.status === "SUSPENDED" || admin.status === "REVOKED" || admin.status === "PENDING_APPROVAL") return respondWithError(403, "ACCOUNT_DISABLED", "This admin access is not active. Ask a superadmin.");
    if (admin.status === "DISABLED") return respondWithError(403, "ACCOUNT_DISABLED", "This admin account is disabled. Ask a superadmin.");
    if (admin.status === "INVITED") return respondWithError(403, "INVITATION_PENDING", "Finish setting up your account from the invitation email first.");
    admin.failedLoginAttempts = 0;
    const mfaToken = createRandomMockToken("mfa");
    readMockDatabase().mfaTokens.set(mfaToken, { adminId: admin.id, expiresAtEpochMs: Date.now() + mfaTokenLifetimeInMilliseconds, failedAttempts: 0, ipAddress: request.headers.get("x-forwarded-for") ?? "127.0.0.1", userAgent: request.headers.get("user-agent") ?? "unknown" });
    return respondWithJson(200, { status: admin.mfaEnrolled ? "mfa_required" : "mfa_enrollment_required", challengeToken: mfaToken, expiresIn: mfaTokenLifetimeInMilliseconds / 1000, passkeyAvailable: admin.passkeys.length > 0 });
  }, { public: true });

  registerMockRoute("POST", "/admin/auth/mfa/enroll/start", (request) => {
    const { admin } = readPendingMfaAdmin(request);
    if (admin.mfaEnrolled) throw new MockHttpError(409, "MFA_ALREADY_ENROLLED", "Authenticator already set up.");
    admin.pendingTotpSecret ??= createBase32Secret();
    const accountName = encodeURIComponent(`Nantty Admin:${admin.email}`);
    return respondWithJson(200, { secret: admin.pendingTotpSecret, issuer: "Nantty Admin", accountName: admin.email, otpauthUri: `otpauth://totp/${accountName}?secret=${admin.pendingTotpSecret}&issuer=Nantty%20Admin&digits=6&period=30&algorithm=SHA1` });
  }, { public: true });

  registerMockRoute("POST", "/admin/auth/mfa/enroll/confirm", (request) => {
    const { admin, mfaToken } = readPendingMfaAdmin(request);
    if (!admin.pendingTotpSecret) throw new MockHttpError(409, "MFA_ENROLLMENT_NOT_STARTED", "Start authenticator setup first.");
    if (!isMockTotpCodeValid(String(readJsonObjectBody(request).code ?? ""))) registerFailedMfaAttempt(mfaToken);
    admin.mfaEnrolled = true;
    admin.pendingTotpSecret = null;
    admin.recoveryCodes = createRecoveryCodes();
    return completeMfaSignIn(admin, mfaToken, { recoveryCodes: admin.recoveryCodes });
  }, { public: true });

  registerMockRoute("POST", "/admin/auth/mfa/webauthn/options", (request) => {
    const { admin } = readPendingMfaAdmin(request);
    if (admin.passkeys.length === 0) throw new MockHttpError(404, "NO_PASSKEYS", "No passkey is registered for this admin.");
    const challenge = createRandomMockToken("chl").slice(4);
    readMockDatabase().webauthnChallenges.set(challenge, { adminId: admin.id, expiresAtEpochMs: Date.now() + 120_000 });
    return respondWithJson(200, { challenge, rpId: "localhost", timeout: 60_000, userVerification: "required", allowCredentials: admin.passkeys.map((passkey) => ({ type: "public-key", id: passkey.credentialId })) });
  }, { public: true });

  registerMockRoute("POST", "/admin/auth/mfa/verify", (request) => {
    const { admin, mfaToken } = readPendingMfaAdmin(request);
    const body = readJsonObjectBody(request);
    if (body.method === "recovery") {
      const code = String(body.code ?? "").toUpperCase();
      const index = admin.recoveryCodes.findIndex((candidate) => areStringsEqualInConstantTime(candidate, code));
      if (index < 0) registerFailedMfaAttempt(mfaToken);
      admin.recoveryCodes.splice(index, 1);
      return completeMfaSignIn(admin, mfaToken);
    }
    if (body.method === "webauthn") {
      const credential = body.credential as { id?: unknown } | null;
      if (!admin.passkeys.some((passkey) => passkey.credentialId === credential?.id)) registerFailedMfaAttempt(mfaToken);
      return completeMfaSignIn(admin, mfaToken);
    }
    if (!isMockTotpCodeValid(String(body.code ?? ""))) registerFailedMfaAttempt(mfaToken);
    return completeMfaSignIn(admin, mfaToken);
  }, { public: true });

  registerMockRoute("POST", "/admin/auth/refresh", (request) => {
    const database = readMockDatabase();
    const refreshToken = String(readJsonObjectBody(request).refreshToken ?? "");
    const record = database.refreshTokens.get(refreshToken);
    if (!record || record.expiresAtEpochMs < Date.now()) return respondWithError(401, "INVALID_REFRESH_TOKEN", "Sign in again.");
    if (record.used) {
      revokeMockAdminSession(record.sessionId);
      return respondWithError(401, "REFRESH_TOKEN_REUSED", "This session was ended for safety. Sign in again.");
    }
    const admin = database.admins.find((candidate) => candidate.id === record.adminId);
    const session = database.adminSessions.get(record.sessionId);
    if (!admin || admin.status !== "ACTIVE" || !session || session.revoked) return respondWithError(401, "INVALID_REFRESH_TOKEN", "Sign in again.");
    record.used = true;
    return respondWithJson(200, issueMockTokenPairForSession(admin.id, session.id));
  }, { public: true });

  registerMockRoute("GET", "/admin/auth/me", (request) => {
    const principal = requireMockPrincipal(request);
    const admin = readMockDatabase().admins.find((candidate) => candidate.id === principal.adminId);
    if (!admin) throw new MockHttpError(401, "UNAUTHENTICATED", "Sign in again.");
    return respondWithJson(200, presentSignedInAdmin(admin));
  });

  registerMockRoute("POST", "/admin/auth/step-up", (request) => {
    const principal = requireMockPrincipal(request);
    const body = readJsonObjectBody(request);
    const admin = readMockDatabase().admins.find((candidate) => candidate.id === principal.adminId);
    const isVerified = body.method === "webauthn" ? admin?.passkeys.some((passkey) => passkey.credentialId === (body.credential as { id?: unknown } | null)?.id) : isMockTotpCodeValid(String(body.code ?? ""));
    if (!isVerified) throw new MockHttpError(401, "INVALID_MFA_CODE", "That code did not work. Try the newest code.");
    const stepUpToken = createRandomMockToken("stp");
    readMockDatabase().stepUpTokens.set(stepUpToken, { adminId: principal.adminId, sessionId: principal.sessionId, expiresAtEpochMs: Date.now() + stepUpLifetimeInSeconds * 1000 });
    return respondWithJson(200, { stepUpToken, expiresIn: stepUpLifetimeInSeconds });
  });

  registerMockRoute("POST", "/admin/auth/step-up/webauthn/options", (request) => {
    const principal = requireMockPrincipal(request);
    const admin = readMockDatabase().admins.find((candidate) => candidate.id === principal.adminId);
    if (!admin || admin.passkeys.length === 0) throw new MockHttpError(404, "NO_PASSKEYS", "You have no passkeys. Use your authenticator code.");
    const challenge = createRandomMockToken("chl").slice(4);
    readMockDatabase().webauthnChallenges.set(challenge, { adminId: admin.id, expiresAtEpochMs: Date.now() + 120_000 });
    return respondWithJson(200, { challenge, rpId: "localhost", timeout: 60_000, userVerification: "required", allowCredentials: admin.passkeys.map((passkey) => ({ type: "public-key", id: passkey.credentialId })) });
  });

  registerMockRoute("POST", "/admin/auth/logout", (request) => {
    const refreshToken = String(readJsonObjectBody(request).refreshToken ?? "");
    const record = readMockDatabase().refreshTokens.get(refreshToken);
    if (record) revokeMockAdminSession(record.sessionId);
    return respondWithNoContent();
  }, { public: true });
}
