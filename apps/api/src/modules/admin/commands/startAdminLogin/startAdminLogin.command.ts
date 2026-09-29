import { Command } from "@zudojs/cqrs";

export class StartAdminLoginCommand extends Command<"admin.startAdminLogin"> {
  public constructor(
    public readonly identifier: string,
    public readonly password: string,
  ) {
    super("admin.startAdminLogin");
  }
}
