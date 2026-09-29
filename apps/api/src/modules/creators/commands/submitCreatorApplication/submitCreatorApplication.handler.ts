import { CommandHandler } from "@zudojs/cqrs";

import { invalidState } from "../../../../errors/domain.error.js";
import type { CreatorApplicationDto } from "../../dtos/creators.dto.js";
import type { CreatorEligibility } from "../../models/creators.model.js";
import { listUnmetCriteria } from "../../services/creatorEligibility.service.js";
import type { CreatorProgramServices } from "../../services/creatorProgramServices.service.js";
import { presentCreatorApplication } from "../../services/creators.service.js";
import type { SubmitCreatorApplicationCommand } from "./submitCreatorApplication.command.js";

export type SubmitCreatorApplicationResult =
  | { readonly outcome: "submitted"; readonly application: CreatorApplicationDto }
  | { readonly outcome: "ineligible"; readonly unmetCriteria: readonly string[]; readonly eligibility: CreatorEligibility };

export class SubmitCreatorApplicationHandler extends CommandHandler<SubmitCreatorApplicationCommand, SubmitCreatorApplicationResult> {
  public readonly commandType = "creators.submitCreatorApplication" as const;

  public constructor(private readonly services: CreatorProgramServices) {
    super();
  }

  public async execute(command: SubmitCreatorApplicationCommand): Promise<SubmitCreatorApplicationResult> {
    const { program, audit, clock } = this.services.creators.dependencies;
    const userId = command.principal.userId;
    const current = await this.services.creators.findProgramStatus(userId);
    if (current.status === "approved" || current.status === "suspended") throw invalidState("You are already in the Creator Program.");
    if (current.status === "pending") throw invalidState("Your creator application is already being reviewed.");
    const eligibility = await this.services.eligibility.evaluateEligibility(userId);
    if (!eligibility.eligible) return { outcome: "ineligible", unmetCriteria: listUnmetCriteria(eligibility), eligibility };
    const application = await program.createApplication({ userId, eligibility, createdAt: clock.now() });
    await audit.record({ actorId: userId, action: "creators.application_submitted", entityType: "creator_application", entityId: application.id, metadata: {} });
    return { outcome: "submitted", application: presentCreatorApplication(application) };
  }
}
