import { CommandHandler } from "@zudojs/cqrs";

import { publishEvent } from "../../../../loaders/events.loader.js";
import { AccountDeactivatedEvent } from "../../events/profileUpdated.event.js";
import type { UsersService } from "../../services/users.service.js";
import type { DeactivateAccountCommand } from "./deactivateAccount.command.js";

export class DeactivateAccountHandler extends CommandHandler<DeactivateAccountCommand, void> {
  public readonly commandType = "users.deactivateAccount" as const;

  public constructor(private readonly usersService: UsersService) {
    super();
  }

  public async execute(command: DeactivateAccountCommand): Promise<void> {
    const { users, sessions, clock, audit, events } = this.usersService.dependencies;
    const user = await this.usersService.findActiveUserOrThrow(command.principal.userId);
    await users.updateStatus(user.id, "deactivated");
    await sessions.revokeAllForUser(user.id, "account_deactivated", clock.now());
    await audit.record({ actorId: user.id, action: "users.account_deactivated", entityType: "user", entityId: user.id });
    await publishEvent(events, AccountDeactivatedEvent, { userId: user.id });
  }
}
