import { CommandHandler } from "@zudojs/cqrs";

import { normalizeCountryCode } from "../../../../configs/currency.config.js";
import type { UserRecord } from "../../models/users.model.js";
import type { UsersService } from "../../services/users.service.js";
import type { UpdatePreferencesCommand } from "./updatePreferences.command.js";

export class UpdatePreferencesHandler extends CommandHandler<UpdatePreferencesCommand, UserRecord> {
  public readonly commandType = "users.updatePreferences" as const;

  public constructor(private readonly usersService: UsersService) {
    super();
  }

  public async execute(command: UpdatePreferencesCommand): Promise<UserRecord> {
    const user = await this.usersService.findActiveUserOrThrow(command.principal.userId);
    const { theme, language, notifications, countryCode, currency } = command.changes;
    const settings = {
      theme: theme ?? user.settings.theme,
      language: language ?? user.settings.language,
      notifications: { ...user.settings.notifications, ...(notifications ?? {}) },
      countryCode: countryCode === undefined ? user.settings.countryCode : normalizeCountryCode(countryCode),
      currency: currency === undefined ? user.settings.currency : currency,
    };
    return (await this.usersService.dependencies.users.updateSettings(user.id, settings)) ?? user;
  }
}
