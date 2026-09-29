import { CommandHandler } from "@zudojs/cqrs";

import type { VerificationRecord } from "../../models/verifications.model.js";
import type { VerificationsService } from "../../services/verifications.service.js";
import type { ReviewVerificationCommand } from "./reviewVerification.command.js";

export class ReviewVerificationHandler extends CommandHandler<ReviewVerificationCommand, VerificationRecord> {
  public readonly commandType = "verifications.reviewVerification" as const;

  public constructor(private readonly service: VerificationsService) {
    super();
  }

  public execute(command: ReviewVerificationCommand): Promise<VerificationRecord> {
    return this.service.reviewVerification(command.principal.userId, command.profileId, command.decision, command.reason);
  }
}
