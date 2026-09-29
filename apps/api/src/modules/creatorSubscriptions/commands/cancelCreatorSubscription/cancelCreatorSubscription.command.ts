import { Command } from "@zudojs/cqrs";

export class CancelCreatorSubscriptionCommand extends Command<"creatorSubscriptions.cancelCreatorSubscription"> {
  public constructor(
    public readonly subscriberId: string,
    public readonly subscriptionId: string,
  ) {
    super("creatorSubscriptions.cancelCreatorSubscription");
  }
}
