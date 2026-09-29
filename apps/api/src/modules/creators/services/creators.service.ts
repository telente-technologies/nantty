import type { EventBus } from "@zudojs/events";

import type { CreatorProgramSettings } from "../../../configs/creators.config.js";
import type { MonetizationSettings } from "../../../configs/monetization.config.js";
import { forbidden } from "../../../errors/domain.error.js";
import type { AuditRecorder } from "../../../interfaces/audit.interface.js";
import type { Clock } from "../../../interfaces/clock.interface.js";
import type { CreatorAccess } from "../../../interfaces/creatorAccess.interface.js";
import type { PersonalVerificationLookup } from "../../../interfaces/creatorEligibility.interface.js";
import type { CreatorWallets } from "../../../interfaces/creatorWallets.interface.js";
import type { OrderLookup } from "../../../interfaces/orderLookup.interface.js";
import type { ProductCatalog } from "../../../interfaces/productCatalog.interface.js";
import type { StoreAccess } from "../../../interfaces/storeAccess.interface.js";
import type { UserAccountStandingLookup, UserDirectory } from "../../../interfaces/userDirectory.interface.js";
import type { AppLogger } from "../../../loggers/app.logger.js";
import type { RepositorySocialGraph } from "../../follows/services/socialGraph.service.js";
import type { PostsService } from "../../posts/services/posts.service.js";
import type { CreatorApplicationDto } from "../dtos/creators.dto.js";
import type { CreatorApplicationRecord, CreatorProfileRecord, CreatorProgramStatus } from "../models/creators.model.js";
import type { AffiliatesRepository } from "../repositories/affiliates.repository.js";
import type { BrandDealsRepository } from "../repositories/brandDeals.repository.js";
import type { CreatorEarningsRepository } from "../repositories/creatorEarnings.repository.js";
import type { CreatorProgramRepository } from "../repositories/creatorProgram.repository.js";

export interface CreatorsDependencies {
  readonly program: CreatorProgramRepository;
  readonly earnings: CreatorEarningsRepository;
  readonly affiliates: AffiliatesRepository;
  readonly postsService: PostsService;
  readonly socialGraph: RepositorySocialGraph;
  readonly userDirectory: UserDirectory & UserAccountStandingLookup;
  readonly verification: PersonalVerificationLookup;
  readonly creatorWallets: CreatorWallets;
  readonly orderLookup: OrderLookup;
  readonly storeAccess: StoreAccess;
  readonly productCatalog: ProductCatalog;
  readonly audit: AuditRecorder;
  readonly events: EventBus;
  readonly clock: Clock;
  readonly settings: CreatorProgramSettings;
  readonly monetization: MonetizationSettings;
  readonly brandDeals: BrandDealsRepository;
  readonly logger: AppLogger;
}

export interface CreatorProgramStatusView {
  readonly status: CreatorProgramStatus;
  readonly canGoLive: boolean;
  readonly tier?: string;
}

export class RepositoryCreatorAccess implements CreatorAccess {
  public constructor(private readonly program: CreatorProgramRepository) {}

  public async isApprovedCreator(userId: string): Promise<boolean> {
    return (await this.program.findProfile(userId))?.status === "approved";
  }

  public async assertApprovedCreator(userId: string): Promise<void> {
    if (!(await this.isApprovedCreator(userId))) throw forbidden("Only approved creators in good standing can do this. Apply to the Creator Program first.");
  }
}

export class CreatorsService {
  public readonly access: RepositoryCreatorAccess;

  public constructor(public readonly dependencies: CreatorsDependencies) {
    this.access = new RepositoryCreatorAccess(dependencies.program);
  }

  public async findProgramStatus(userId: string): Promise<CreatorProgramStatusView> {
    const profile = await this.dependencies.program.findProfile(userId);
    if (profile !== undefined) return { status: profile.status, canGoLive: profile.status === "approved", tier: profile.tier };
    const application = await this.dependencies.program.findLatestApplicationForUser(userId);
    return { status: application?.status ?? "none", canGoLive: false };
  }

  public async findApprovedProfileOrThrow(userId: string): Promise<CreatorProfileRecord> {
    const profile = await this.dependencies.program.findProfile(userId);
    if (profile?.status !== "approved") throw forbidden("Only approved creators in good standing can do this. Apply to the Creator Program first.");
    return profile;
  }

  public calculateSinceForPeriod(period: "today" | "week" | "month" | "all"): Date | null {
    const now = this.dependencies.clock.now();
    if (period === "all") return null;
    if (period === "today") return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const days = period === "week" ? 7 : 30;
    return new Date(now.getTime() - days * 86_400_000);
  }
}

export function presentCreatorApplication(application: CreatorApplicationRecord): CreatorApplicationDto {
  return {
    id: application.id,
    userId: application.userId,
    status: application.status,
    eligibility: application.eligibility,
    reviewNote: application.reviewNote,
    reviewedAt: application.reviewedAt?.toISOString() ?? null,
    createdAt: application.createdAt.toISOString(),
  };
}
