import { randomBytes } from "node:crypto";

import { adminError } from "../../../utils/adminHttp.util.js";
import type { StaffAccountRecord, StaffChallengeRecord, StaffSessionRecord } from "../models/platformStaff.model.js";
import type { IssuedAdminTokens, StaffClient } from "./adminTokens.service.js";
import type { AdminIdentityDto, PlatformStaffService } from "./platformStaff.service.js";
import type { TotpEnrollment } from "./staffMfa.service.js";
import { staffIpAddressIsAllowed } from "./staffRequestGuard.service.js";

export interface AdminLoginStarted {
  readonly mfaToken: string;
  readonly enrollmentRequired: boolean;
  readonly passkeyAvailable: boolean;
}

export interface AdminSignedIn {
  readonly tokens: IssuedAdminTokens;
  readonly admin: AdminIdentityDto;
  readonly recoveryCodes?: readonly string[];
}

export type SecondFactorMethod = "totp" | "recovery" | "webauthn";

export interface SecondFactorProof {
  readonly method: SecondFactorMethod;
  readonly code?: string | undefined;
  readonly credential?: unknown;
}

const INVALID_CREDENTIALS = "The email or password is not correct.";

function newOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

export class AdminSignInService {
  public constructor(private readonly staff: PlatformStaffService) {}

  public async startLogin(email: string, password: string, client: StaffClient): Promise<AdminLoginStarted> {
    const { accounts, passwords, clock, settings, security } = this.staff.dependencies;
    const account = await accounts.findByEmail(email.trim().toLowerCase());
    const passwordMatches = await passwords.verifyPasswordAgainstStoredHash(password, account?.passwordHash ?? null);
    if (account === undefined) {
      await this.staff.recordAudit({ actorId: null, actorKind: "SYSTEM", action: "admin.sign_in_failed", entityType: "admin", entityId: "unknown", ...this.describeClient(client) });
      throw adminError(401, "INVALID_CREDENTIALS", INVALID_CREDENTIALS);
    }
    const now = clock.now();
    if (account.lockedUntil !== null && account.lockedUntil > now) {
      throw adminError(423, "ACCOUNT_LOCKED", "Too many failed attempts. Try again later.", { lockedUntil: account.lockedUntil.toISOString() });
    }
    if (!passwordMatches) {
      const lockedUntil = await this.recordFailedPassword(account, client);
      if (lockedUntil !== null) throw adminError(423, "ACCOUNT_LOCKED", "Too many failed attempts. Try again later.", { lockedUntil: lockedUntil.toISOString() });
      throw adminError(401, "INVALID_CREDENTIALS", INVALID_CREDENTIALS);
    }
    if (account.status === "INVITED") throw adminError(403, "INVITATION_PENDING", "Accept your invitation before signing in.");
    if (account.status === "DISABLED") throw adminError(403, "ACCOUNT_DISABLED", "This admin account is disabled.");
    if (!staffIpAddressIsAllowed(settings, account, client.ipAddress)) throw adminError(403, "IP_NOT_ALLOWED", "The admin console cannot be used from this network.");
    if (account.failedLoginCount > 0) await accounts.update(account.id, { failedLoginCount: 0, lockedUntil: null }, now);
    return this.issueMfaChallenge(account, (await security.listWebAuthnCredentials(account.id)).length > 0);
  }

  public async issueMfaChallenge(account: StaffAccountRecord, passkeyAvailable: boolean): Promise<AdminLoginStarted> {
    const { security, clock, settings } = this.staff.dependencies;
    const mfaToken = newOpaqueToken();
    const now = clock.now();
    await security.createChallenge(account.id, await this.staff.hashToken("challenge", mfaToken), new Date(now.getTime() + settings.mfaChallengeTtlSeconds * 1000), now);
    return { mfaToken, enrollmentRequired: account.totpEnabledAt === null, passkeyAvailable };
  }

  public async beginTotpEnrollment(mfaToken: string): Promise<TotpEnrollment> {
    const { account } = await this.findChallengeOrThrow(mfaToken);
    if (account.totpEnabledAt !== null) throw adminError(409, "MFA_ALREADY_ENROLLED", "Two-factor authentication is already set up.");
    return this.staff.dependencies.mfa.beginTotpEnrollment(account);
  }

  public async confirmTotpEnrollment(mfaToken: string, code: string, client: StaffClient): Promise<AdminSignedIn> {
    const { challenge, account } = await this.findChallengeOrThrow(mfaToken);
    if (account.totpEnabledAt !== null) throw adminError(409, "MFA_ALREADY_ENROLLED", "Two-factor authentication is already set up.");
    const recoveryCodes = await this.staff.dependencies.mfa.confirmPendingTotpEnrollment(account, code);
    if (recoveryCodes === undefined) return this.rejectWrongCode(challenge);
    await this.staff.recordAudit({ actorId: account.id, actorKind: "ADMIN", actorName: account.name, actorRole: account.role, action: "admin.mfa_enrolled", entityType: "admin", entityId: account.id, targetLabel: account.email, ...this.describeClient(client) });
    return { ...(await this.completeSignIn(challenge, await this.staff.findAccountOrThrow(account.id), client, "totp")), recoveryCodes };
  }

  public async verifySecondFactor(mfaToken: string, proof: SecondFactorProof, client: StaffClient): Promise<AdminSignedIn> {
    const { challenge, account } = await this.findChallengeOrThrow(mfaToken);
    if (account.totpEnabledAt === null) throw adminError(403, "MFA_ENROLLMENT_REQUIRED", "Set up two-factor authentication first.");
    const verified = await this.checkProof(account, proof, challenge.webAuthnChallenge);
    if (!verified) return this.rejectWrongCode(challenge);
    return this.completeSignIn(challenge, account, client, proof.method);
  }

  public async createSignInPasskeyOptions(mfaToken: string): Promise<unknown> {
    const { challenge, account } = await this.findChallengeOrThrow(mfaToken);
    const credentials = await this.staff.dependencies.security.listWebAuthnCredentials(account.id);
    if (credentials.length === 0) throw adminError(404, "NO_PASSKEYS", "No passkeys are registered for this admin.");
    const generated = await this.staff.dependencies.webAuthn.createAuthenticationOptions(credentials);
    await this.staff.dependencies.security.storeChallengeWebAuthnChallenge(challenge.id, generated.challenge);
    return generated.options;
  }

  public async stepUp(account: StaffAccountRecord, session: StaffSessionRecord, proof: SecondFactorProof): Promise<{ readonly stepUpToken: string; readonly expiresIn: number }> {
    const { security, clock, settings } = this.staff.dependencies;
    const pendingChallenge = session.webAuthnChallengeExpiresAt !== null && session.webAuthnChallengeExpiresAt > clock.now() ? session.webAuthnChallenge : null;
    if (proof.method === "recovery" || !(await this.checkProof(account, proof, pendingChallenge))) throw adminError(401, "INVALID_MFA_CODE", "That code is not correct.");
    const stepUpToken = newOpaqueToken();
    const expiresAt = new Date(clock.now().getTime() + settings.stepUpTtlSeconds * 1000);
    await security.updateSession(session.id, { stepUpTokenHash: await this.staff.hashToken("stepUp", stepUpToken), stepUpExpiresAt: expiresAt, webAuthnChallenge: null, webAuthnChallengeExpiresAt: null });
    await this.staff.recordAudit({ actorId: account.id, action: "admin.step_up", entityType: "admin", entityId: account.id, targetLabel: account.email, metadata: { method: proof.method, sessionId: session.id } });
    return { stepUpToken, expiresIn: settings.stepUpTtlSeconds };
  }

  public async createStepUpPasskeyOptions(account: StaffAccountRecord, session: StaffSessionRecord): Promise<unknown> {
    const { security, webAuthn, clock, settings } = this.staff.dependencies;
    const credentials = await security.listWebAuthnCredentials(account.id);
    if (credentials.length === 0) throw adminError(404, "NO_PASSKEYS", "No passkeys are registered for this admin.");
    const generated = await webAuthn.createAuthenticationOptions(credentials);
    await security.updateSession(session.id, { webAuthnChallenge: generated.challenge, webAuthnChallengeExpiresAt: new Date(clock.now().getTime() + settings.mfaChallengeTtlSeconds * 1000) });
    return generated.options;
  }

  public async refresh(refreshToken: string): Promise<IssuedAdminTokens> {
    return this.staff.dependencies.tokens.rotateRefreshToken(refreshToken);
  }

  public async logout(refreshToken: string): Promise<void> {
    const { tokens, security, clock } = this.staff.dependencies;
    const sessionId = tokens.findSessionIdInRefreshToken(refreshToken);
    if (sessionId === undefined) return;
    const session = await security.findSession(sessionId);
    if (session === undefined || session.revokedAt !== null) return;
    await security.revokeSession(session.id, "signed_out", clock.now());
    await this.staff.recordAudit({ actorId: session.staffId, actorKind: "ADMIN", action: "admin.signed_out", entityType: "admin", entityId: session.staffId, metadata: { sessionId: session.id } });
  }

  private async checkProof(account: StaffAccountRecord, proof: SecondFactorProof, expectedWebAuthnChallenge: string | null): Promise<boolean> {
    const { mfa, security, webAuthn, clock } = this.staff.dependencies;
    if (proof.method === "totp") return proof.code !== undefined && mfa.verifyTotpCodeOnce(account, proof.code);
    if (proof.method === "recovery") return proof.code !== undefined && mfa.consumeRecoveryCode(account, proof.code);
    if (expectedWebAuthnChallenge === null) return false;
    const credentialId = webAuthn.findCredentialIdInResponse(proof.credential);
    const credential = credentialId === undefined ? undefined : await security.findWebAuthnCredential(credentialId);
    if (credential === undefined || credential.staffId !== account.id) return false;
    const verified = await webAuthn.verifyAuthentication(credential, proof.credential, expectedWebAuthnChallenge);
    if (verified === undefined) return false;
    await security.recordWebAuthnCredentialUse(credential.id, verified.newSignCount, clock.now());
    return true;
  }

  private async completeSignIn(challenge: StaffChallengeRecord, account: StaffAccountRecord, client: StaffClient, method: SecondFactorMethod): Promise<AdminSignedIn> {
    const { security, tokens, clock, accounts } = this.staff.dependencies;
    if (!(await security.consumeChallenge(challenge.id, clock.now()))) throw adminError(401, "MFA_CHALLENGE_EXPIRED", "Your sign-in attempt expired. Start again.");
    const issued = await tokens.startSession(account, client);
    const updated = (await accounts.update(account.id, { lastLoginAt: clock.now() }, clock.now())) ?? account;
    await this.staff.recordAudit({
      actorId: account.id,
      actorKind: "ADMIN",
      actorName: account.name,
      actorRole: account.role,
      action: "admin.signed_in",
      entityType: "admin",
      entityId: account.id,
      targetLabel: account.email,
      metadata: { method, sessionId: issued.sessionId },
      ...this.describeClient(client),
    });
    return { tokens: issued, admin: this.staff.presentIdentity(updated) };
  }

  private async rejectWrongCode(challenge: StaffChallengeRecord): Promise<never> {
    const { security, clock, settings } = this.staff.dependencies;
    const attempts = await security.countFailedChallengeAttempt(challenge.id);
    if (attempts >= settings.maxMfaAttempts) await security.consumeChallenge(challenge.id, clock.now());
    throw adminError(401, "INVALID_MFA_CODE", "That code is not correct.");
  }

  private async findChallengeOrThrow(mfaToken: string): Promise<{ readonly challenge: StaffChallengeRecord; readonly account: StaffAccountRecord }> {
    const { security, accounts, clock } = this.staff.dependencies;
    const challenge = await security.findUsableChallenge(await this.staff.hashToken("challenge", mfaToken), clock.now());
    if (challenge === undefined) throw adminError(401, "MFA_CHALLENGE_EXPIRED", "Your sign-in attempt expired. Start again.");
    const account = await accounts.findById(challenge.staffId);
    if (account === undefined || account.status !== "ACTIVE") throw adminError(403, "ACCOUNT_DISABLED", "This admin account is disabled.");
    return { challenge, account };
  }

  private async recordFailedPassword(account: StaffAccountRecord, client: StaffClient): Promise<Date | null> {
    const { accounts, clock, settings } = this.staff.dependencies;
    const now = clock.now();
    const failures = account.failedLoginCount + 1;
    const locks = failures >= settings.maxFailedPasswordAttempts;
    const lockedUntil = locks ? new Date(now.getTime() + settings.lockoutSeconds * 1000) : null;
    await accounts.update(account.id, lockedUntil === null ? { failedLoginCount: failures } : { failedLoginCount: 0, lockedUntil }, now);
    await this.staff.recordAudit({ actorId: account.id, actorKind: "ADMIN", actorName: account.name, action: locks ? "admin.locked" : "admin.sign_in_failed", entityType: "admin", entityId: account.id, targetLabel: account.email, ...this.describeClient(client) });
    return lockedUntil;
  }

  private describeClient(client: StaffClient): { readonly ip?: string } {
    return client.ipAddress === null ? {} : { ip: client.ipAddress };
  }
}
