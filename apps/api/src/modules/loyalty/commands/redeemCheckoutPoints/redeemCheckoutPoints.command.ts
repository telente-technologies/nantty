import { Command } from "@zudojs/cqrs";

export class RedeemCheckoutPointsCommand extends Command<"loyalty.redeemCheckoutPoints"> {
  public constructor(
    public readonly userId: string,
    public readonly checkoutId: string,
    public readonly points: number,
  ) {
    super("loyalty.redeemCheckoutPoints");
  }
}
