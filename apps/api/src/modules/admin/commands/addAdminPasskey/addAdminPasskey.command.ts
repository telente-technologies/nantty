import { Command } from "@zudojs/cqrs";

import type { StaffRequestState } from "../../services/staffRequestGuard.service.js";

export class AddAdminPasskeyCommand extends Command<"admin.addAdminPasskey"> {
  public constructor(
    public readonly staff: StaffRequestState,
    public readonly label: string,
    public readonly credential: unknown,
  ) {
    super("admin.addAdminPasskey");
  }
}
