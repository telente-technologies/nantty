import { BaseModule, type ModuleContext } from "@zudojs/core";
import type { CommandBus, QueryBus } from "@zudojs/cqrs";

import { registerCommandHandlers, registerQueryHandlers } from "../../utils/cqrs.util.js";
import { ChangeCreatorAffiliationHandler } from "./commands/changeCreatorAffiliation/changeCreatorAffiliation.handler.js";
import { ChangeCreatorStandingHandler } from "./commands/changeCreatorStanding/changeCreatorStanding.handler.js";
import { RemoveAffiliateCommissionHandler } from "./commands/removeAffiliateCommission/removeAffiliateCommission.handler.js";
import { ReviewCreatorApplicationHandler } from "./commands/reviewCreatorApplication/reviewCreatorApplication.handler.js";
import { SendLiveGiftHandler } from "./commands/sendLiveGift/sendLiveGift.handler.js";
import { SetAffiliateCommissionHandler } from "./commands/setAffiliateCommission/setAffiliateCommission.handler.js";
import { SubmitCreatorApplicationHandler } from "./commands/submitCreatorApplication/submitCreatorApplication.handler.js";
import { GetCreatorDashboardHandler } from "./queries/getCreatorDashboard/getCreatorDashboard.handler.js";
import { GetCreatorEligibilityHandler } from "./queries/getCreatorEligibility/getCreatorEligibility.handler.js";
import { GetMyCreatorApplicationHandler } from "./queries/getMyCreatorApplication/getMyCreatorApplication.handler.js";
import { GetMyCreatorStatusHandler } from "./queries/getMyCreatorStatus/getMyCreatorStatus.handler.js";
import { ListAffiliateCommissionsHandler } from "./queries/listAffiliateCommissions/listAffiliateCommissions.handler.js";
import { ListCreatorAffiliationsHandler } from "./queries/listCreatorAffiliations/listCreatorAffiliations.handler.js";
import { ListCreatorApplicationsHandler } from "./queries/listCreatorApplications/listCreatorApplications.handler.js";
import { ListCreatorEarningsHandler } from "./queries/listCreatorEarnings/listCreatorEarnings.handler.js";
import { ListGiftCatalogHandler } from "./queries/listGiftCatalog/listGiftCatalog.handler.js";
import type { CreatorProgramServices } from "./services/creatorProgramServices.service.js";

export class CreatorsModule extends BaseModule {
  public readonly id = "creators";
  public readonly name = "creators";

  public constructor() {
    super({ version: "0.1.0" });
  }

  public override async onInitialize(context: ModuleContext): Promise<void> {
    context.logger.info("creators module initialized");
  }

  public override async onShutdown(context: ModuleContext): Promise<void> {
    context.logger.info("creators module stopped");
  }
}

export function registerCreatorsCommandAndQueryHandlers(commands: CommandBus, queries: QueryBus, services: CreatorProgramServices): void {
  registerCommandHandlers(commands, [
    new SubmitCreatorApplicationHandler(services),
    new ReviewCreatorApplicationHandler(services),
    new ChangeCreatorStandingHandler(services),
    new SendLiveGiftHandler(services),
    new ChangeCreatorAffiliationHandler(services),
    new SetAffiliateCommissionHandler(services),
    new RemoveAffiliateCommissionHandler(services),
  ]);
  registerQueryHandlers(queries, [
    new GetMyCreatorStatusHandler(services),
    new GetCreatorEligibilityHandler(services),
    new GetMyCreatorApplicationHandler(services),
    new ListCreatorApplicationsHandler(services),
    new GetCreatorDashboardHandler(services),
    new ListCreatorEarningsHandler(services),
    new ListCreatorAffiliationsHandler(services),
    new ListGiftCatalogHandler(),
    new ListAffiliateCommissionsHandler(services),
  ]);
}
