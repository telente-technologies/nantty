import type { AuditRecorder } from "../interfaces/audit.interface.js";
import type { VerificationBadgeLookup } from "../interfaces/verificationBadge.interface.js";
import { registerAuthCommandAndQueryHandlers } from "../modules/auth/auth.module.js";
import { AuthController } from "../modules/auth/controllers/auth.controller.js";
import { PrismaOneTimeCodesRepository, PrismaSessionsRepository, PrismaSocialIdentitiesRepository } from "../modules/auth/repositories/auth.prisma.repository.js";
import { InMemoryOneTimeCodesRepository, InMemorySessionsRepository, InMemorySocialIdentitiesRepository } from "../modules/auth/repositories/auth.repository.js";
import { AuthService } from "../modules/auth/services/auth.service.js";
import { JsonWebKeyIdentityTokenVerifier, type IdentityTokenVerifier } from "../modules/auth/services/identityToken.service.js";
import { EmailOneTimeCodeDelivery } from "../modules/auth/services/otpDelivery.service.js";
import { OtpService, type OneTimeCodeDelivery } from "../modules/auth/services/otp.service.js";
import { PasswordService } from "../modules/auth/services/password.service.js";
import { TokenService } from "../modules/auth/services/token.service.js";
import { UsersController } from "../modules/users/controllers/users.controller.js";
import { InMemoryAddressesRepository, PrismaAddressesRepository } from "../modules/users/repositories/addresses.repository.js";
import { InMemoryTopicsRepository, PrismaTopicsRepository } from "../modules/users/repositories/topics.repository.js";
import { PrismaUsersRepository } from "../modules/users/repositories/users.prisma.repository.js";
import { InMemoryUsersRepository } from "../modules/users/repositories/users.repository.js";
import { RepositoryAddressBook } from "../modules/users/services/addressBook.service.js";
import { RepositoryUserDirectory } from "../modules/users/services/userDirectory.service.js";
import { UsersService } from "../modules/users/services/users.service.js";
import { registerUsersCommandAndQueryHandlers } from "../modules/users/users.module.js";
import type { Core } from "./core.loader.js";

export interface IdentityExternalServices {
  readonly identityTokenVerifier?: IdentityTokenVerifier;
  readonly oneTimeCodeDelivery?: OneTimeCodeDelivery;
}

export function createIdentityModules(core: Core, audit: AuditRecorder, external: IdentityExternalServices, verificationBadges?: VerificationBadgeLookup) {
  const usePrisma = core.persistence === "prisma";
  const users = usePrisma ? new PrismaUsersRepository() : new InMemoryUsersRepository();
  const sessions = usePrisma ? new PrismaSessionsRepository() : new InMemorySessionsRepository();
  const oneTimeCodes = usePrisma ? new PrismaOneTimeCodesRepository() : new InMemoryOneTimeCodesRepository();
  const socialIdentities = usePrisma ? new PrismaSocialIdentitiesRepository() : new InMemorySocialIdentitiesRepository();
  const addresses = usePrisma ? new PrismaAddressesRepository() : new InMemoryAddressesRepository();
  const topics = usePrisma ? new PrismaTopicsRepository() : new InMemoryTopicsRepository();

  const tokens = new TokenService(core.settings.auth, sessions, users, core.clock);
  const otp = new OtpService(
    oneTimeCodes,
    external.oneTimeCodeDelivery ?? new EmailOneTimeCodeDelivery(core.logger),
    core.settings.auth,
    core.clock,
    core.settings.dataEncryptionKey,
  );
  const identityTokens =
    external.identityTokenVerifier ??
    new JsonWebKeyIdentityTokenVerifier(core.settings.auth.googleClientIds, core.settings.auth.appleClientIds, core.clock);
  const passwords = new PasswordService();
  const authService = new AuthService({
    users, sessions, oneTimeCodes, socialIdentities, tokens, otp, identityTokens,
    passwords,
    events: core.events,
    clock: core.clock,
    audit,
  });
  registerAuthCommandAndQueryHandlers(core.commands, core.queries, authService);

  const usersService = new UsersService({ users, addresses, topics, sessions, cipher: core.cipher, events: core.events, clock: core.clock, audit });
  registerUsersCommandAndQueryHandlers(core.commands, core.queries, usersService);

  return {
    accessTokenVerifier: tokens,
    internals: { users, sessions, tokens, passwords, authService },
    userDirectory: new RepositoryUserDirectory(users, topics, verificationBadges),
    addressBook: new RepositoryAddressBook(addresses, core.cipher),
    authController: new AuthController(core.commands, core.queries),
    usersController: new UsersController(core.commands, core.queries, verificationBadges),
  };
}
