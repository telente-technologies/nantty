import { CommandHandler } from "@zudojs/cqrs";

import type { CreatorAffiliationDto } from "../../dtos/creators.dto.js";
import type { CreatorProgramServices } from "../../services/creatorProgramServices.service.js";
import type { ChangeCreatorAffiliationCommand } from "./changeCreatorAffiliation.command.js";

export class ChangeCreatorAffiliationHandler extends CommandHandler<ChangeCreatorAffiliationCommand, readonly CreatorAffiliationDto[]> {
  public readonly commandType = "creators.changeCreatorAffiliation" as const;

  public constructor(private readonly services: CreatorProgramServices) {
    super();
  }

  public async execute(command: ChangeCreatorAffiliationCommand): Promise<readonly CreatorAffiliationDto[]> {
    const { affiliates, clock } = this.services.creators.dependencies;
    const creatorId = command.principal.userId;
    await this.services.creators.findApprovedProfileOrThrow(creatorId);
    const target = await this.services.affiliations.resolveTargetOrThrow(command.target, command.affiliated);
    if (command.affiliated) {
      await affiliates.addAffiliation({ creatorId, storeId: target.storeId, productId: target.productId, createdAt: clock.now() });
    } else {
      await affiliates.removeAffiliation(creatorId, target.storeId, target.productId);
    }
    return this.services.affiliations.presentAffiliations(creatorId);
  }
}
