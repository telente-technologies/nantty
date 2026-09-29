import type { EventBus } from "@zudojs/events";

import type { AdsSettings } from "../../../configs/intelligence.config.js";
import type { AdvertiserBilling } from "../../../interfaces/advertiserBilling.interface.js";
import type { AuditRecorder } from "../../../interfaces/audit.interface.js";
import type { Clock } from "../../../interfaces/clock.interface.js";
import type { CurrencyConverter } from "../../../interfaces/currencyConverter.interface.js";
import type { EntitlementsLookup } from "../../../interfaces/entitlements.interface.js";
import type { IdentifierHasher, IntelligenceEventSink, IntelligenceRanking } from "../../../interfaces/intelligence.interface.js";
import type { MediaLibrary } from "../../../interfaces/mediaLibrary.interface.js";
import type { OrderLookup } from "../../../interfaces/orderLookup.interface.js";
import type { ProductCatalog } from "../../../interfaces/productCatalog.interface.js";
import type { StoreAccess } from "../../../interfaces/storeAccess.interface.js";
import type { UserDirectory } from "../../../interfaces/userDirectory.interface.js";
import type { VerificationBadgeLookup } from "../../../interfaces/verificationBadge.interface.js";
import type { AppLogger } from "../../../loggers/app.logger.js";
import type { FieldCipher } from "../../../utils/crypto.util.js";
import type { LiveSessionsRepository } from "../../posts/repositories/live.repository.js";
import type { PostsRepository } from "../../posts/repositories/posts.repository.js";
import type { AdAccountsRepository } from "../repositories/adAccounts.repository.js";
import type { AdBoostsRepository } from "../repositories/adBoosts.repository.js";
import type { AdCampaignsRepository } from "../repositories/adCampaigns.repository.js";
import type { AdDeliveryRepository } from "../repositories/adDelivery.repository.js";
import type { AdInvitesRepository } from "../repositories/adInvites.repository.js";
import type { AdPoliciesRepository } from "../repositories/adPolicies.repository.js";
import type { AdSpendRepository } from "../repositories/adSpend.repository.js";

export interface AdsRepositories {
  readonly accounts: AdAccountsRepository;
  readonly invites: AdInvitesRepository;
  readonly campaigns: AdCampaignsRepository;
  readonly spend: AdSpendRepository;
  readonly delivery: AdDeliveryRepository;
  readonly boosts: AdBoostsRepository;
  readonly policies: AdPoliciesRepository;
}

export interface AdsPorts {
  readonly storeAccess: StoreAccess;
  readonly userDirectory: UserDirectory;
  readonly productCatalog: ProductCatalog;
  readonly posts: PostsRepository;
  readonly liveSessions: LiveSessionsRepository;
  readonly mediaLibrary: MediaLibrary;
  readonly advertiserBilling: AdvertiserBilling;
  readonly currencyConverter: CurrencyConverter;
  readonly audit: AuditRecorder;
  readonly entitlements: EntitlementsLookup;
  readonly verificationBadges: VerificationBadgeLookup;
  readonly orderLookup: OrderLookup;
  readonly ranking: IntelligenceRanking;
  readonly eventSink: IntelligenceEventSink;
  readonly hasher: IdentifierHasher;
}

export interface AdsDependencies extends AdsRepositories, AdsPorts {
  readonly events: EventBus;
  readonly clock: Clock;
  readonly cipher: FieldCipher;
  readonly logger: AppLogger;
  readonly settings: AdsSettings;
}
