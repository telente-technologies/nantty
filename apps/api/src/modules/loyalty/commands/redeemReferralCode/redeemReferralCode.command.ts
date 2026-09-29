import { Command } from "@zudojs/cqrs";

export class RedeemReferralCodeCommand extends Command<"loyalty.redeemReferralCode"> {
  public constructor(
    public readonly userId: string,
    public readonly code: string,
  ) {
    super("loyalty.redeemReferralCode");
  }
}
