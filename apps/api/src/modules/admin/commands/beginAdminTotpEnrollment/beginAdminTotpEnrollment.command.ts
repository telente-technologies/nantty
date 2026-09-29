import { Command } from "@zudojs/cqrs";

export class BeginAdminTotpEnrollmentCommand extends Command<"admin.beginAdminTotpEnrollment"> {
  public constructor(
    public readonly mfaToken: string,
  ) {
    super("admin.beginAdminTotpEnrollment");
  }
}
