import type { EventBus } from "@zudojs/events";

import { Role } from "../../../constants/roles.constant.js";
import { unprocessable } from "../../../errors/domain.error.js";
import type { AuditRecorder } from "../../../interfaces/audit.interface.js";
import type { Clock } from "../../../interfaces/clock.interface.js";
import type { NewUserInput, UserRecord } from "../../users/models/users.model.js";
import type { UsersRepository } from "../../users/repositories/users.repository.js";
import type { OneTimeCodesRepository, SessionsRepository, SocialIdentitiesRepository } from "../repositories/auth.repository.js";
import { normalizePhoneNumber, type ContactAddress } from "./contact.service.js";
import type { IdentityTokenVerifier } from "./identity-token.service.js";
import type { OtpService } from "./otp.service.js";
import type { PasswordService } from "./password.service.js";
import type { TokenService } from "./token.service.js";

export const MINIMUM_ACCOUNT_AGE_YEARS = 13;

export interface AuthDependencies {
  readonly users: UsersRepository;
  readonly sessions: SessionsRepository;
  readonly oneTimeCodes: OneTimeCodesRepository;
  readonly socialIdentities: SocialIdentitiesRepository;
  readonly passwords: PasswordService;
  readonly tokens: TokenService;
  readonly otp: OtpService;
  readonly identityTokens: IdentityTokenVerifier;
  readonly events: EventBus;
  readonly clock: Clock;
  readonly audit: AuditRecorder;
}

export class AuthService {
  public constructor(public readonly dependencies: AuthDependencies) {}

  public async findUserByContact(contact: ContactAddress): Promise<UserRecord | undefined> {
    return contact.kind === "email" ? this.dependencies.users.findByEmail(contact.value) : this.dependencies.users.findByPhone(contact.value);
  }

  public async findUserByEmailPhoneOrUsername(identifier: string): Promise<UserRecord | undefined> {
    const trimmed = identifier.trim();
    if (trimmed.includes("@")) return this.dependencies.users.findByEmail(trimmed.toLowerCase());
    if (/^\+?\d[\d\s()-]{6,}$/.test(trimmed)) return this.dependencies.users.findByPhone(normalizePhoneNumber(trimmed));
    return this.dependencies.users.findByUsername(trimmed.toLowerCase());
  }

  public assertBirthdayMeetsMinimumAge(birthday: Date): void {
    const now = this.dependencies.clock.now();
    const cutoff = new Date(Date.UTC(now.getUTCFullYear() - MINIMUM_ACCOUNT_AGE_YEARS, now.getUTCMonth(), now.getUTCDate()));
    if (birthday > cutoff) throw unprocessable(`You must be at least ${MINIMUM_ACCOUNT_AGE_YEARS} years old to use Zudomart.`);
  }

  public createBuyerAccount(input: Omit<NewUserInput, "roles">): Promise<UserRecord> {
    return this.dependencies.users.create({ ...input, roles: [Role.BUYER] });
  }
}
