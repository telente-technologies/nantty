import { Command } from "@zudojs/cqrs";

export class ReleaseCheckoutPointsCommand extends Command<"loyalty.releaseCheckoutPoints"> {
  public constructor(
    public readonly userId: string,
    public readonly checkoutId: string,
  ) {
    super("loyalty.releaseCheckoutPoints");
  }
}
