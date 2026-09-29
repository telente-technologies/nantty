import { adminError } from "../../../utils/adminHttp.util.js";
import type { StaffAccountRecord, StaffSessionRecord, WebAuthnCredentialRecord } from "../models/platformStaff.model.js";
import type { PlatformStaffService } from "./platformStaff.service.js";

export interface PasskeyDto {
  readonly id: string;
  readonly label: string;
  readonly createdAt: string;
  readonly lastUsedAt: string | null;
}

function convertPasskeyToDto(credential: WebAuthnCredentialRecord): PasskeyDto {
  return { id: credential.id, label: credential.label, createdAt: credential.createdAt.toISOString(), lastUsedAt: credential.lastUsedAt?.toISOString() ?? null };
}

export class StaffSelfService {
  public constructor(private readonly staff: PlatformStaffService) {}

  public async describeAccount(account: StaffAccountRecord) {
    const passkeys = await this.staff.dependencies.security.listWebAuthnCredentials(account.id);
    return { account: await this.staff.presentAccountSummary(account), recoveryCodesRemaining: account.recoveryCodeHashes.length, passkeys: passkeys.map(convertPasskeyToDto) };
  }

  public async listSessions(account: StaffAccountRecord, currentSessionId: string) {
    const sessions = await this.staff.dependencies.security.listActiveSessions(account.id, this.staff.dependencies.clock.now());
    return {
      items: sessions.map((session) => ({
        id: session.id,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
        startedAt: session.createdAt.toISOString(),
        lastSeenAt: session.lastSeenAt.toISOString(),
        isCurrent: session.id === currentSessionId,
      })),
    };
  }

  public async revokeSession(account: StaffAccountRecord, sessionId: string): Promise<void> {
    const { security, clock } = this.staff.dependencies;
    const session = await security.findSession(sessionId);
    if (session === undefined || session.staffId !== account.id) throw adminError(404, "NOT_FOUND", "Session was not found.");
    await security.revokeSession(session.id, "revoked_by_admin", clock.now());
    await this.staff.recordAudit({ actorId: account.id, action: "admin.session_revoked", entityType: "admin", entityId: account.id, targetLabel: account.email, metadata: { sessionId } });
  }

  public async regenerateRecoveryCodes(account: StaffAccountRecord): Promise<{ readonly recoveryCodes: readonly string[] }> {
    if (account.totpEnabledAt === null) throw adminError(409, "MFA_NOT_ENROLLED", "Set up an authenticator app first.");
    const recoveryCodes = await this.staff.dependencies.mfa.regenerateRecoveryCodes(account);
    await this.staff.recordAudit({ actorId: account.id, action: "admin.recovery_codes_regenerated", entityType: "admin", entityId: account.id, targetLabel: account.email });
    return { recoveryCodes };
  }

  public async createPasskeyRegistrationOptions(account: StaffAccountRecord, session: StaffSessionRecord): Promise<unknown> {
    const { security, webAuthn, clock, settings } = this.staff.dependencies;
    const existing = await security.listWebAuthnCredentials(account.id);
    const generated = await webAuthn.createRegistrationOptions(account, existing);
    await security.updateSession(session.id, { webAuthnChallenge: generated.challenge, webAuthnChallengeExpiresAt: new Date(clock.now().getTime() + settings.mfaChallengeTtlSeconds * 1000) });
    return generated.options;
  }

  public async addPasskey(account: StaffAccountRecord, session: StaffSessionRecord, label: string, credential: unknown): Promise<PasskeyDto> {
    const { security, webAuthn, clock } = this.staff.dependencies;
    const expected = session.webAuthnChallengeExpiresAt !== null && session.webAuthnChallengeExpiresAt > clock.now() ? session.webAuthnChallenge : null;
    if (expected === null) throw adminError(409, "PASSKEY_CHALLENGE_EXPIRED", "Start adding the passkey again.");
    const verified = await webAuthn.verifyRegistration(credential, expected);
    if (verified === undefined) throw adminError(400, "PASSKEY_NOT_VERIFIED", "The passkey could not be verified.");
    if (await security.findWebAuthnCredential(verified.credentialId)) throw adminError(409, "PASSKEY_EXISTS", "This passkey is already registered.");
    const stored = await security.addWebAuthnCredential({ staffId: account.id, credentialId: verified.credentialId, publicKey: verified.publicKey, signCount: verified.signCount, transports: verified.transports, label: label.trim() }, clock.now());
    await security.updateSession(session.id, { webAuthnChallenge: null, webAuthnChallengeExpiresAt: null });
    await this.staff.recordAudit({ actorId: account.id, action: "admin.passkey_added", entityType: "admin", entityId: account.id, targetLabel: account.email, after: { passkeyId: stored.id, label: stored.label } });
    return convertPasskeyToDto(stored);
  }

  public async removePasskey(account: StaffAccountRecord, passkeyId: string): Promise<void> {
    if (!(await this.staff.dependencies.security.removeWebAuthnCredential(account.id, passkeyId))) throw adminError(404, "NOT_FOUND", "Passkey was not found.");
    await this.staff.recordAudit({ actorId: account.id, action: "admin.passkey_removed", entityType: "admin", entityId: account.id, targetLabel: account.email, before: { passkeyId } });
  }
}
