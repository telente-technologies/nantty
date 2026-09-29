import { AffiliateCommissionsService } from "./affiliateCommissions.service.js";
import { AffiliationsService } from "./affiliations.service.js";
import { CreatorDashboardService } from "./creatorDashboard.service.js";
import { CreatorEligibilityService } from "./creatorEligibility.service.js";
import { CreatorsService, type CreatorsDependencies } from "./creators.service.js";
import { LiveGiftsService } from "./liveGifts.service.js";

export interface CreatorProgramServices {
  readonly creators: CreatorsService;
  readonly eligibility: CreatorEligibilityService;
  readonly gifts: LiveGiftsService;
  readonly commissions: AffiliateCommissionsService;
  readonly dashboard: CreatorDashboardService;
  readonly affiliations: AffiliationsService;
}

export function createCreatorProgramServices(dependencies: CreatorsDependencies): CreatorProgramServices {
  const creators = new CreatorsService(dependencies);
  return {
    creators,
    eligibility: new CreatorEligibilityService(dependencies),
    gifts: new LiveGiftsService(creators),
    commissions: new AffiliateCommissionsService(creators),
    dashboard: new CreatorDashboardService(creators),
    affiliations: new AffiliationsService(creators),
  };
}
