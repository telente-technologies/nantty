import { CommandHandler } from "@zudojs/cqrs";

import type { VerificationRecord } from "../../models/verifications.model.js";
import type { VerificationsService } from "../../services/verifications.service.js";
import type { ApplyForVerificationCommand } from "./applyForVerification.command.js";

export class ApplyForVerificationHandler extends CommandHandler<ApplyForVerificationCommand, VerificationRecord> {
  public readonly commandType = "verifications.applyForVerification" as const;

  public constructor(private readonly service: VerificationsService) {
    super();
  }

  public execute(command: ApplyForVerificationCommand): Promise<VerificationRecord> {
    return this.service.applyForVerification(command.principal, command.application);
  }
}
