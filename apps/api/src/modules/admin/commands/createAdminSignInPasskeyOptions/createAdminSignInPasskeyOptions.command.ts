import { Command } from "@zudojs/cqrs";

export class CreateAdminSignInPasskeyOptionsCommand extends Command<"admin.createAdminSignInPasskeyOptions"> {
  public constructor(
    public readonly mfaToken: string,
  ) {
    super("admin.createAdminSignInPasskeyOptions");
  }
}
