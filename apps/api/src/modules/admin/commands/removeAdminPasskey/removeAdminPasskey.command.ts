import { Command } from "@zudojs/cqrs";

import type { StaffRequestState } from "../../services/staffRequestGuard.service.js";

export class RemoveAdminPasskeyCommand extends Command<"admin.removeAdminPasskey"> {
  public constructor(
    public readonly staff: StaffRequestState,
    public readonly passkeyId: string,
  ) {
    super("admin.removeAdminPasskey");
  }
}
