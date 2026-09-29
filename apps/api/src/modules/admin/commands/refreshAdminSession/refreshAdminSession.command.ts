import { Command } from "@zudojs/cqrs";

export class RefreshAdminSessionCommand extends Command<"admin.refreshAdminSession"> {
  public constructor(
    public readonly refreshToken: string,
  ) {
    super("admin.refreshAdminSession");
  }
}
