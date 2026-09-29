import { CommandHandler } from "@zudojs/cqrs";

import { notFound } from "../../../../errors/domain.error.js";
import type { CreatorProgramServices } from "../../services/creatorProgramServices.service.js";
import type { RemoveAffiliateCommissionCommand } from "./removeAffiliateCommission.command.js";

export class RemoveAffiliateCommissionHandler extends CommandHandler<RemoveAffiliateCommissionCommand, void> {
  public readonly commandType = "creators.removeAffiliateCommission" as const;

  public constructor(private readonly services: CreatorProgramServices) {
    super();
  }

  public async execute(command: RemoveAffiliateCommissionCommand): Promise<void> {
    const { affiliates, audit } = this.services.creators.dependencies;
    const target = await this.services.affiliations.resolveSellerCommissionTarget(command.principal, command.target);
    if (!(await affiliates.removeCommission(target.storeId, target.productId))) throw notFound("Affiliate commission");
    await audit.record({
      actorId: command.principal.userId,
      action: "creators.affiliate_commission_removed",
      entityType: "store",
      entityId: target.storeId,
      metadata: { productId: target.productId },
    });
  }
}
