import { Command } from "@zudojs/cqrs";

export class BeginAdminTotpEnrollmentCommand extends Command<"admin.beginAdminTotpEnrollment"> {
  public constructor(
    public readonly challengeToken: string,
  ) {
    super("admin.beginAdminTotpEnrollment");
  }
}
