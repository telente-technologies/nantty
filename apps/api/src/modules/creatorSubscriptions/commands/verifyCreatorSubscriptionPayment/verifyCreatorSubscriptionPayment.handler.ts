import { CommandHandler } from "@zudojs/cqrs";

import type { CreatorSubscriptionRecord } from "../../models/creatorSubscriptions.model.js";
import type { CreatorSubscriptionsServices } from "../../services/creatorSubscriptionsServices.service.js";
import type { VerifyCreatorSubscriptionPaymentCommand } from "./verifyCreatorSubscriptionPayment.command.js";

export class VerifyCreatorSubscriptionPaymentHandler extends CommandHandler<VerifyCreatorSubscriptionPaymentCommand, CreatorSubscriptionRecord> {
  public readonly commandType = "creatorSubscriptions.verifyCreatorSubscriptionPayment" as const;

  public constructor(private readonly service: CreatorSubscriptionsServices) {
    super();
  }

  public execute(command: VerifyCreatorSubscriptionPaymentCommand): Promise<CreatorSubscriptionRecord> {
    return this.service.billing.verifyChargeForSubscriber(command.subscriberId, command.reference);
  }
}
