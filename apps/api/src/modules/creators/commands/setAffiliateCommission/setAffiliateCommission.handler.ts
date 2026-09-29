import { CommandHandler } from "@zudojs/cqrs";

import { unprocessable } from "../../../../errors/domain.error.js";
import type { AffiliateCommissionDto } from "../../dtos/creators.dto.js";
import { presentAffiliateCommission } from "../../services/affiliations.service.js";
import type { CreatorProgramServices } from "../../services/creatorProgramServices.service.js";
import type { SetAffiliateCommissionCommand } from "./setAffiliateCommission.command.js";

export class SetAffiliateCommissionHandler extends CommandHandler<SetAffiliateCommissionCommand, AffiliateCommissionDto> {
  public readonly commandType = "creators.setAffiliateCommission" as const;

  public constructor(private readonly services: CreatorProgramServices) {
    super();
  }

  public async execute(command: SetAffiliateCommissionCommand): Promise<AffiliateCommissionDto> {
    const { affiliates, audit, clock, settings } = this.services.creators.dependencies;
    if (command.commissionBps > settings.maximumAffiliateCommissionBps) {
      throw unprocessable(`Affiliate commission cannot exceed ${settings.maximumAffiliateCommissionBps / 100}%.`);
    }
    const target = await this.services.affiliations.resolveSellerCommissionTarget(command.principal, command.target);
    const saved = await affiliates.saveCommission({ ...target, commissionBps: command.commissionBps, updatedById: command.principal.userId, updatedAt: clock.now() });
    await audit.record({
      actorId: command.principal.userId,
      action: "creators.affiliate_commission_set",
      entityType: "store",
      entityId: target.storeId,
      metadata: { productId: target.productId, commissionBps: command.commissionBps },
    });
    return presentAffiliateCommission(saved);
  }
}
