import { Command } from "@zudojs/cqrs";

import type { StaffClient } from "../../services/adminTokens.service.js";

export class ConfirmAdminTotpEnrollmentCommand extends Command<"admin.confirmAdminTotpEnrollment"> {
  public constructor(
    public readonly mfaToken: string,
    public readonly code: string,
    public readonly client: StaffClient,
  ) {
    super("admin.confirmAdminTotpEnrollment");
  }
}
