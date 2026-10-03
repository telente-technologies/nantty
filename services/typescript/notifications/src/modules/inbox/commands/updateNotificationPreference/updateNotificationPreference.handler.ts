import { lockedPreferenceCategories } from "../../../../constants/notificationCategories.constant.js";
import { validationError } from "../../../../errors/notifications.error.js";
import type { PreferenceRepository } from "../../../../interfaces/repositories.interface.js";
import type { UpdateNotificationPreferenceCommand } from "./updateNotificationPreference.command.js";

export class UpdateNotificationPreferenceHandler {
  public constructor(private readonly preferences: PreferenceRepository) {}

  public async execute(command: UpdateNotificationPreferenceCommand) {
    if (lockedPreferenceCategories.has(command.category)) throw validationError(`${command.category} notifications cannot be turned off.`);
    const changes = { ...(command.push === undefined ? {} : { push: command.push }), ...(command.email === undefined ? {} : { email: command.email }) };
    const row = await this.preferences.upsert(command.userId, command.category, changes);
    return { category: row.category, push: row.push, email: row.email, locked: false };
  }
}
