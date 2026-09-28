import { randomBytes } from "node:crypto";

import { CommandHandler } from "@zudojs/cqrs";
import { ForbiddenError } from "@zudojs/errors";

import { publishEvent } from "../../../../loaders/events.loader.js";
import type { UserRecord } from "../../../users/models/users.model.js";
import { UserLoggedInEvent } from "../../events/userLoggedIn.event.js";
import { UserRegisteredEvent } from "../../events/userRegistered.event.js";
import type { AuthenticationResult, VerifiedSocialIdentity } from "../../models/auth.model.js";
import type { AuthService } from "../../services/auth.service.js";
import { normalizeUsername } from "../../services/contact.service.js";
import type { SocialSignInCommand } from "./socialSignIn.command.js";

export class SocialSignInHandler extends CommandHandler<SocialSignInCommand, AuthenticationResult> {
  public readonly commandType = "auth.socialSignIn" as const;

  public constructor(private readonly auth: AuthService) {
    super();
  }

  public async execute(command: SocialSignInCommand): Promise<AuthenticationResult> {
    const { identityTokens, socialIdentities, users, tokens, events, clock } = this.auth.dependencies;
    const identity = await identityTokens.verifyIdentityToken(command.provider, command.input.idToken);
    const linkedUserId = await socialIdentities.findUserIdForIdentity(identity.provider, identity.subject);
    let user = linkedUserId === undefined ? undefined : await users.findById(linkedUserId);
    if (user === undefined && identity.email !== null && identity.emailVerified) user = await users.findByEmail(identity.email);
    const isNewUser = user === undefined;
    user ??= await this.auth.createBuyerAccount({
      email: identity.emailVerified ? identity.email : null,
      phone: null,
      username: await this.chooseAvailableUsername(command.input.username, identity),
      passwordHash: null,
      name: command.input.name?.trim() ?? identity.name ?? "",
      birthday: null,
      emailVerifiedAt: identity.emailVerified ? clock.now() : null,
    });
    if (user.status !== "active") throw new ForbiddenError("This account has been deactivated.");
    await socialIdentities.linkIdentity(user.id, identity.provider, identity.subject);
    const issued = await tokens.startSessionForUser(user, command.client);
    if (isNewUser) await publishEvent(events, UserRegisteredEvent, { userId: user.id, username: user.username, method: identity.provider });
    await publishEvent(events, UserLoggedInEvent, { userId: user.id, sessionId: issued.sessionId, method: identity.provider });
    return { user: user satisfies UserRecord, tokens: issued, isNewUser };
  }

  private async chooseAvailableUsername(requested: string | undefined, identity: VerifiedSocialIdentity): Promise<string> {
    const { users } = this.auth.dependencies;
    if (requested !== undefined) {
      const username = normalizeUsername(requested);
      if ((await users.findByUsername(username)) === undefined) return username;
    }
    const base = normalizeUsername((identity.email?.split("@")[0] ?? identity.name ?? "user").replace(/[^A-Za-z0-9_.]/g, "")).slice(0, 20) || "user";
    return `${base}${randomBytes(3).toString("hex")}`;
  }
}
