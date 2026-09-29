import { randomBytes } from "node:crypto";

import { UnauthorizedError } from "@zudojs/errors";

import { invalidState, unprocessable } from "../../../errors/domain.error.js";
import type { Principal } from "../../../interfaces/principal.interface.js";
import { hashSecretWithKey } from "../../../utils/hashToken.util.js";
import type { ClientDetails, IssuedTokens } from "../../auth/models/auth.model.js";
import type { AuthService } from "../../auth/services/auth.service.js";
import type { StaffAccountRecord, StaffLoginChallengeRecord } from "../models/platformStaff.model.js";
import type { PlatformStaffService } from "./platformStaff.service.js";
import type { SecondFactorProof, TotpEnrollment } from "./staffMfa.service.js";

const INCORRECT_LOGIN = "Incorrect login details.";
const INCORRECT_CODE = "That code is not correct. Try again.";

export interface AdminLoginChallenge {
  readonly challengeToken: string;
  readonly expiresIn: number;
  readonly mfaEnrollmentRequired: boolean;
  readonly methods: readonly ("totp" | "recovery_code")[];
}

export interface CompletedAdminLogin {
  readonly tokens: IssuedTokens;
  readonly recoveryCodes: readonly string[] | null;
}

export class AdminSessionService {
  public constructor(
    private readonly staff: PlatformStaffService,
    private readonly auth: AuthService,
    private readonly challengeHashKey: Uint8Array,
  ) {}

  public async startLogin(identifier: string, password: string): Promise<AdminLoginChallenge> {
    const { passwords, accounts, security, clock, settings } = this.staff.dependencies;
    const user = await this.auth.findUserByEmailPhoneOrUsername(identifier);
    const passwordMatches = await passwords.verifyPasswordAgainstStoredHash(password, user?.passwordHash ?? null);
    if (user === undefined || !passwordMatches || user.status !== "active") throw new UnauthorizedError(INCORRECT_LOGIN);
    const account = await accounts.findByUserId(user.id);
    if (account === undefined || account.status !== "active") throw new UnauthorizedError(INCORRECT_LOGIN);
    const challengeToken = randomBytes(32).toString("base64url");
    const now = clock.now();
    await security.createLoginChallenge(user.id, await this.hashChallengeToken(challengeToken), new Date(now.getTime() + settings.loginChallengeTtlSeconds * 1000), now);
    const mfaEnrollmentRequired = account.totpEnabledAt === null;
    return { challengeToken, expiresIn: settings.loginChallengeTtlSeconds, mfaEnrollmentRequired, methods: mfaEnrollmentRequired ? ["totp"] : ["totp", "recovery_code"] };
  }

  public async beginTotpEnrollment(challengeToken: string): Promise<TotpEnrollment> {
    const { account } = await this.findChallengeWithAccountOrThrow(challengeToken);
    if (account.totpEnabledAt !== null) throw invalidState("Two-factor authentication is already set up. Enter your code to continue.");
    const user = await this.staff.findUserOrThrow(account.userId);
    return this.staff.dependencies.mfa.beginTotpEnrollment(account, this.staff.describeAccountLabel(user));
  }

  public async completeLogin(challengeToken: string, proof: SecondFactorProof, client: ClientDetails): Promise<CompletedAdminLogin> {
    const { security, tokens, clock, audit } = this.staff.dependencies;
    const { challenge, account } = await this.findChallengeWithAccountOrThrow(challengeToken);
    const recoveryCodes = await this.verifyLoginSecondFactor(account, proof);
    if (recoveryCodes === false) {
      const attempts = await security.countFailedLoginChallengeAttempt(challenge.id);
      if (attempts >= this.staff.dependencies.settings.maxMfaAttempts) await security.consumeLoginChallenge(challenge.id, clock.now());
      throw new UnauthorizedError(INCORRECT_CODE);
    }
    if (!(await security.consumeLoginChallenge(challenge.id, clock.now()))) throw new UnauthorizedError(INCORRECT_LOGIN);
    const user = await this.staff.findUserOrThrow(account.userId);
    const issued = await tokens.startAdminSessionForUser(user, client);
    const now = clock.now();
    await security.createStaffSession({ sessionId: issued.sessionId, userId: user.id, mfaVerifiedAt: now, stepUpVerifiedAt: now, createdAt: now });
    await audit.record({
      actorId: user.id,
      action: recoveryCodes === null ? "admin.signed_in" : "admin.mfa_enrolled",
      entityType: "platform_staff_account",
      entityId: user.id,
      metadata: { sessionId: issued.sessionId, method: proof.recoveryCode === undefined ? "totp" : "recovery_code" },
      ...(client.ip === null ? {} : { ip: client.ip }),
    });
    return { tokens: issued, recoveryCodes };
  }

  public async stepUp(principal: Principal, proof: SecondFactorProof): Promise<Date> {
    const { mfa, security, clock, audit } = this.staff.dependencies;
    const { account } = await this.staff.findVerifiedStaffSessionOrThrow(principal);
    if (!(await mfa.verifySecondFactor(account, proof))) throw unprocessable(INCORRECT_CODE);
    await security.markStaffSessionSteppedUp(principal.sessionId, clock.now());
    await audit.record({ actorId: principal.userId, action: "admin.stepped_up", entityType: "platform_staff_account", entityId: principal.userId, metadata: { sessionId: principal.sessionId } });
    const session = await security.findStaffSession(principal.sessionId);
    return session === undefined ? clock.now() : this.staff.stepUpValidUntil(session);
  }

  private async verifyLoginSecondFactor(account: StaffAccountRecord, proof: SecondFactorProof): Promise<readonly string[] | null | false> {
    const { mfa } = this.staff.dependencies;
    if (account.totpEnabledAt === null) {
      if (proof.code === undefined) return false;
      return (await mfa.confirmPendingTotpEnrollment(account, proof.code)) ?? false;
    }
    return (await mfa.verifySecondFactor(account, proof)) ? null : false;
  }

  private async findChallengeWithAccountOrThrow(challengeToken: string): Promise<{ readonly challenge: StaffLoginChallengeRecord; readonly account: StaffAccountRecord }> {
    const { security, accounts, clock } = this.staff.dependencies;
    const challenge = await security.findUsableLoginChallenge(await this.hashChallengeToken(challengeToken), clock.now());
    if (challenge === undefined) throw new UnauthorizedError("Your sign-in attempt expired. Start again.");
    const account = await accounts.findByUserId(challenge.userId);
    if (account === undefined || account.status !== "active") throw new UnauthorizedError(INCORRECT_LOGIN);
    return { challenge, account };
  }

  private hashChallengeToken(token: string): Promise<string> {
    return hashSecretWithKey(token, this.challengeHashKey);
  }
}
