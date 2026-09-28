import { Command } from "@zudojs/cqrs";

export class RequestPasswordResetCommand extends Command<"auth.requestPasswordReset"> {
  public constructor(
    public readonly target: string,
  ) {
    super("auth.requestPasswordReset");
  }
}
