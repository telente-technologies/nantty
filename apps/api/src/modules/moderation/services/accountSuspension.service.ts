import type { AccountSuspensionLookup } from "../../../interfaces/accountStanding.interface.js";
import type { Clock } from "../../../interfaces/clock.interface.js";
import type { AccessTokenVerifier, Principal } from "../../../interfaces/principal.interface.js";
import type { ModerationDecisionsRepository } from "../repositories/decisions.repository.js";

export class RepositoryAccountSuspensionLookup implements AccountSuspensionLookup {
  public constructor(private readonly decisions: ModerationDecisionsRepository) {}

  public async isAccountSuspended(userId: string, now: Date): Promise<boolean> {
    return (await this.decisions.findActiveSuspension(userId, now)) !== undefined;
  }
}

export class SuspensionAwareAccessTokenVerifier implements AccessTokenVerifier {
  public constructor(
    private readonly inner: AccessTokenVerifier,
    private readonly suspensions: AccountSuspensionLookup,
    private readonly clock: Clock,
  ) {}

  public async verify(accessToken: string): Promise<Principal> {
    const principal = await this.inner.verify(accessToken);
    if (!(await this.suspensions.isAccountSuspended(principal.userId, this.clock.now()))) return principal;
    return { ...principal, roles: [] };
  }
}
