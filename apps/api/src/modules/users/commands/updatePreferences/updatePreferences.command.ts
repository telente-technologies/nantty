import { Command } from "@zudojs/cqrs";

import type { Principal } from "../../../../interfaces/principal.interface.js";
import type { UpdateSettingsBody } from "../../validators/users.validator.js";

export class UpdatePreferencesCommand extends Command<"users.updatePreferences"> {
  public constructor(
    public readonly principal: Principal,
    public readonly changes: UpdateSettingsBody,
  ) {
    super("users.updatePreferences");
  }
}
