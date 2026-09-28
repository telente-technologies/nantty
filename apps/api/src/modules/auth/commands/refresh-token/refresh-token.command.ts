import { Command } from "@zudojs/cqrs";

export class RefreshTokenCommand extends Command<"auth.refresh-token"> {
  public constructor(
    public readonly refreshToken: string,
  ) {
    super("auth.refresh-token");
  }
}
