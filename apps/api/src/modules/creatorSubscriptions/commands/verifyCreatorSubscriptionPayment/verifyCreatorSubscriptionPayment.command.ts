import { Command } from "@zudojs/cqrs";

export class VerifyCreatorSubscriptionPaymentCommand extends Command<"creatorSubscriptions.verifyCreatorSubscriptionPayment"> {
  public constructor(
    public readonly subscriberId: string,
    public readonly reference: string,
  ) {
    super("creatorSubscriptions.verifyCreatorSubscriptionPayment");
  }
}
