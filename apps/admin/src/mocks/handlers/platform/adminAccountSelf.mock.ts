import { recordMockAuditEntry } from "@/mocks/mockAudit.mock";
import { createRandomMockToken, createRecoveryCodes, revokeMockAdminSession } from "@/mocks/mockAuthTokens.mock";
import { readMockDatabase } from "@/mocks/mockDatabase.mock";
import { requireMockPrincipal, requireMockStepUp } from "@/mocks/mockGuards.mock";
import { MockHttpError, failNotFound, readIsoNow, readJsonObjectBody, readRequiredTrimmedString, respondWithJson, respondWithNoContent } from "@/mocks/mockResponses.mock";
import { registerMockRoute, type MockRequest } from "@/mocks/mockRouter.mock";
import { presentAdminAccountSummary } from "@/mocks/handlers/platform/adminAccounts.mock";

function readSignedInAdminRecord(request: MockRequest) {
  const principal = requireMockPrincipal(request);
  const admin = readMockDatabase().admins.find((candidate) => candidate.id === principal.adminId);
  if (!admin) throw new MockHttpError(401, "UNAUTHENTICATED", "Sign in again.");
  return { principal, admin };
}

export function registerAdminAccountSelfMockHandlers(): void {
  registerMockRoute("GET", "/admin/account", (request) => {
    const { admin } = readSignedInAdminRecord(request);
    return respondWithJson(200, {
      account: presentAdminAccountSummary(admin),
      recoveryCodesRemaining: admin.recoveryCodes.length,
      passkeys: admin.passkeys.map(({ id, label, createdAt, lastUsedAt }) => ({ id, label, createdAt, lastUsedAt })),
    });
  });

  registerMockRoute("GET", "/admin/account/sessions", (request) => {
    const { principal } = readSignedInAdminRecord(request);
    const sessions = [...readMockDatabase().adminSessions.values()]
      .filter((session) => session.adminId === principal.adminId && !session.revoked)
      .map((session) => ({ id: session.id, ipAddress: session.ipAddress, userAgent: session.userAgent, startedAt: session.startedAt, lastSeenAt: session.lastSeenAt, isCurrent: session.id === principal.sessionId }));
    return respondWithJson(200, { items: sessions });
  });

  registerMockRoute("POST", "/admin/account/sessions/:sessionId/revoke", (request) => {
    const { principal } = readSignedInAdminRecord(request);
    const session = readMockDatabase().adminSessions.get(request.params.sessionId ?? "");
    if (!session || session.adminId !== principal.adminId) failNotFound("Session");
    revokeMockAdminSession(session.id);
    recordMockAuditEntry(request, { action: "admin.session_revoked", area: "account", target: { type: "adminSession", id: session.id, label: session.userAgent.slice(0, 40) } });
    return respondWithNoContent();
  });

  registerMockRoute("POST", "/admin/account/recovery-codes/regenerate", (request) => {
    requireMockStepUp(request);
    const { admin } = readSignedInAdminRecord(request);
    admin.recoveryCodes = createRecoveryCodes();
    recordMockAuditEntry(request, { action: "admin.recovery_codes_regenerated", area: "account", target: { type: "admin", id: admin.id, label: admin.name } });
    return respondWithJson(200, { recoveryCodes: admin.recoveryCodes });
  });

  registerMockRoute("POST", "/admin/account/passkeys/options", (request) => {
    const { admin } = readSignedInAdminRecord(request);
    const challenge = createRandomMockToken("chl").slice(4);
    readMockDatabase().webauthnChallenges.set(challenge, { adminId: admin.id, expiresAtEpochMs: Date.now() + 120_000 });
    return respondWithJson(200, {
      challenge,
      rp: { name: "Nantty Admin", id: "localhost" },
      user: { id: Buffer.from(admin.id).toString("base64url"), name: admin.email, displayName: admin.name },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: { residentKey: "preferred", userVerification: "required" },
      excludeCredentials: admin.passkeys.map((passkey) => ({ type: "public-key", id: passkey.credentialId })),
      timeout: 60_000,
      attestation: "none",
    });
  });

  registerMockRoute("POST", "/admin/account/passkeys", (request) => {
    const { admin } = readSignedInAdminRecord(request);
    const body = readJsonObjectBody(request);
    const label = readRequiredTrimmedString(body, "label", 60);
    const credential = body.credential as { id?: unknown } | null;
    if (typeof credential?.id !== "string" || credential.id.length < 8) throw new MockHttpError(400, "INVALID_CREDENTIAL", "The passkey response could not be read.");
    const passkey = { id: createRandomMockToken("pk", 8), credentialId: credential.id, label, createdAt: readIsoNow(), lastUsedAt: null };
    admin.passkeys.push(passkey);
    recordMockAuditEntry(request, { action: "admin.passkey_added", area: "account", target: { type: "admin", id: admin.id, label: admin.name }, after: { label } });
    return respondWithJson(201, { id: passkey.id, label, createdAt: passkey.createdAt, lastUsedAt: null });
  });

  registerMockRoute("DELETE", "/admin/account/passkeys/:passkeyId", (request) => {
    const { admin } = readSignedInAdminRecord(request);
    const passkey = admin.passkeys.find((candidate) => candidate.id === request.params.passkeyId);
    if (!passkey) failNotFound("Passkey");
    admin.passkeys = admin.passkeys.filter((candidate) => candidate.id !== passkey.id);
    recordMockAuditEntry(request, { action: "admin.passkey_removed", area: "account", target: { type: "admin", id: admin.id, label: admin.name }, before: { label: passkey.label } });
    return respondWithNoContent();
  });
}
