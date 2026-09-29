import { Command } from "@zudojs/cqrs";

export class ResumeCreatorSubscriptionCommand extends Command<"creatorSubscriptions.resumeCreatorSubscription"> {
  public constructor(
    public readonly subscriberId: string,
    public readonly subscriptionId: string,
  ) {
    super("creatorSubscriptions.resumeCreatorSubscription");
  }
}
