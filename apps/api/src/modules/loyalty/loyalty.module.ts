import { BaseModule, type ModuleContext } from "@zudojs/core";
import type { CommandBus, QueryBus } from "@zudojs/cqrs";

import { registerCommandHandlers, registerQueryHandlers } from "../../utils/cqrs.util.js";
import { RedeemReferralCodeHandler } from "./commands/redeemReferralCode/redeemReferralCode.handler.js";
import { RedeemCheckoutPointsHandler } from "./commands/redeemCheckoutPoints/redeemCheckoutPoints.handler.js";
import { ReleaseCheckoutPointsHandler } from "./commands/releaseCheckoutPoints/releaseCheckoutPoints.handler.js";
import { CreateCashbackPromoHandler } from "./commands/createCashbackPromo/createCashbackPromo.handler.js";
import { DeactivateCashbackPromoHandler } from "./commands/deactivateCashbackPromo/deactivateCashbackPromo.handler.js";
import { GetLoyaltySummaryHandler } from "./queries/getLoyaltySummary/getLoyaltySummary.handler.js";
import { GetReferralSummaryHandler } from "./queries/getReferralSummary/getReferralSummary.handler.js";
import { ListLoyaltyHistoryHandler } from "./queries/listLoyaltyHistory/listLoyaltyHistory.handler.js";
import { ListCashbackPromosHandler } from "./queries/listCashbackPromos/listCashbackPromos.handler.js";
import type { LoyaltyServices } from "./services/loyaltyServices.service.js";

export class LoyaltyModule extends BaseModule {
  public readonly id = "loyalty";
  public readonly name = "loyalty";

  public constructor() {
    super({ version: "0.1.0" });
  }

  public override async onInitialize(context: ModuleContext): Promise<void> {
    context.logger.info("loyalty module initialized");
  }

  public override async onShutdown(context: ModuleContext): Promise<void> {
    context.logger.info("loyalty module stopped");
  }
}

export function registerLoyaltyCommandAndQueryHandlers(commands: CommandBus, queries: QueryBus, services: LoyaltyServices): void {
  registerCommandHandlers(commands, [new RedeemReferralCodeHandler(services), new RedeemCheckoutPointsHandler(services), new ReleaseCheckoutPointsHandler(services), new CreateCashbackPromoHandler(services), new DeactivateCashbackPromoHandler(services)]);
  registerQueryHandlers(queries, [new GetLoyaltySummaryHandler(services), new GetReferralSummaryHandler(services), new ListLoyaltyHistoryHandler(services), new ListCashbackPromosHandler(services)]);
}
