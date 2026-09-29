import { Command } from "@zudojs/cqrs";

import type { StaffRequestState } from "../../services/staffRequestGuard.service.js";

export class ChangeAdminPermissionsCommand extends Command<"admin.changeAdminPermissions"> {
  public constructor(
    public readonly staff: StaffRequestState,
    public readonly staffId: string,
    public readonly role: "ADMIN" | "SUPPORT",
    public readonly permissions: readonly string[],
    public readonly reason: string,
  ) {
    super("admin.changeAdminPermissions");
  }
}
