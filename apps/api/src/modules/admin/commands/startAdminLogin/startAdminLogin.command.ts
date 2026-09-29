import { Command } from "@zudojs/cqrs";

import type { StaffClient } from "../../services/adminTokens.service.js";

export class StartAdminLoginCommand extends Command<"admin.startAdminLogin"> {
  public constructor(
    public readonly email: string,
    public readonly password: string,
    public readonly client: StaffClient,
  ) {
    super("admin.startAdminLogin");
  }
}
