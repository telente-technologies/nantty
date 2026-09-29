import { Command } from "@zudojs/cqrs";

export class LogoutAdminCommand extends Command<"admin.logoutAdmin"> {
  public constructor(
    public readonly refreshToken: string,
  ) {
    super("admin.logoutAdmin");
  }
}
