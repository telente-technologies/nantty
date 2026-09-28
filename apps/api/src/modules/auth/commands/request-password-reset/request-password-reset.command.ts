import { Command } from "@zudojs/cqrs";

export class RequestPasswordResetCommand extends Command<"auth.request-password-reset"> {
  public constructor(
    public readonly target: string,
  ) {
    super("auth.request-password-reset");
  }
}
