import { CommandHandler } from "@zudojs/cqrs";

import { publishEvent } from "../../../../loaders/events.loader.js";
import { normalizeUsername } from "../../../auth/services/contact.service.js";
import { ProfileUpdatedEvent } from "../../events/profileUpdated.event.js";
import type { UserRecord } from "../../models/users.model.js";
import type { UsersService } from "../../services/users.service.js";
import type { UpdateProfileCommand } from "./updateProfile.command.js";

export class UpdateProfileHandler extends CommandHandler<UpdateProfileCommand, UserRecord> {
  public readonly commandType = "users.updateProfile" as const;

  public constructor(private readonly usersService: UsersService) {
    super();
  }

  public async execute(command: UpdateProfileCommand): Promise<UserRecord> {
    const { users, events } = this.usersService.dependencies;
    await this.usersService.findActiveUserOrThrow(command.principal.userId);
    const { username, name, bio, ...images } = command.changes;
    const updated = await users.updateProfile(command.principal.userId, {
      ...images,
      ...(username === undefined ? {} : { username: normalizeUsername(username) }),
      ...(name === undefined ? {} : { name: name.trim() }),
      ...(bio === undefined ? {} : { bio: bio.trim() }),
    });
    const user = updated ?? (await this.usersService.findActiveUserOrThrow(command.principal.userId));
    await publishEvent(events, ProfileUpdatedEvent, { userId: user.id });
    return user;
  }
}
