import { Command } from "@zudojs/cqrs";

export class AcceptAdminInvitationCommand extends Command<"admin.acceptAdminInvitation"> {
  public constructor(
    public readonly token: string,
    public readonly password: string,
  ) {
    super("admin.acceptAdminInvitation");
  }
}
