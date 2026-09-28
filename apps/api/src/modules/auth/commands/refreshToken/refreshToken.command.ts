import { Command } from "@zudojs/cqrs";

export class RefreshTokenCommand extends Command<"auth.refreshToken"> {
  public constructor(
    public readonly refreshToken: string,
  ) {
    super("auth.refreshToken");
  }
}
