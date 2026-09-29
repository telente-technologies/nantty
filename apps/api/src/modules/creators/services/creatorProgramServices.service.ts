import { AffiliateCommissionsService } from "./affiliateCommissions.service.js";
import { AffiliationsService } from "./affiliations.service.js";
import { BrandDealsService } from "./brandDeals.service.js";
import { CreatorCashOutService } from "./creatorCashOut.service.js";
import { CreatorDashboardService } from "./creatorDashboard.service.js";
import { CreatorEligibilityService } from "./creatorEligibility.service.js";
import { CreatorsService, type CreatorsDependencies } from "./creators.service.js";
import { LiveGiftsService } from "./liveGifts.service.js";
import { TipsService } from "./tips.service.js";

export interface CreatorProgramServices {
  readonly creators: CreatorsService;
  readonly eligibility: CreatorEligibilityService;
  readonly gifts: LiveGiftsService;
  readonly commissions: AffiliateCommissionsService;
  readonly dashboard: CreatorDashboardService;
  readonly affiliations: AffiliationsService;
  readonly tips: TipsService;
  readonly cashOut: CreatorCashOutService;
  readonly brandDeals: BrandDealsService;
}

export function createCreatorProgramServices(dependencies: CreatorsDependencies): CreatorProgramServices {
  const creators = new CreatorsService(dependencies);
  const gifts = new LiveGiftsService(creators);
  return {
    creators,
    eligibility: new CreatorEligibilityService(dependencies),
    gifts,
    tips: new TipsService(creators, gifts),
    cashOut: new CreatorCashOutService(creators, dependencies.monetization),
    brandDeals: new BrandDealsService(creators, dependencies.brandDeals),
    commissions: new AffiliateCommissionsService(creators),
    dashboard: new CreatorDashboardService(creators),
    affiliations: new AffiliationsService(creators),
  };
}
