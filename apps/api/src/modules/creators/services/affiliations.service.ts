import { StoreRole } from "../../../constants/roles.constant.js";
import { notFound, unprocessable } from "../../../errors/domain.error.js";
import type { Principal } from "../../../interfaces/principal.interface.js";
import { resolveSellerStoreIdForUser } from "../../../utils/sellerStore.util.js";
import type { AffiliateCommissionDto, CreatorAffiliationDto } from "../dtos/creators.dto.js";
import type { AffiliateCommissionRecord } from "../models/creators.model.js";
import type { CreatorsService } from "./creators.service.js";

export interface AffiliateTarget {
  readonly storeId?: string;
  readonly productId?: string;
}

const COMMISSION_MANAGER_ROLES = [StoreRole.OWNER, StoreRole.MANAGER] as const;

export function presentAffiliateCommission(commission: AffiliateCommissionRecord): AffiliateCommissionDto {
  return {
    id: commission.id,
    storeId: commission.storeId,
    productId: commission.productId,
    commissionBps: commission.commissionBps,
    commissionPercent: commission.commissionBps / 100,
    updatedAt: commission.updatedAt.toISOString(),
  };
}

export class AffiliationsService {
  public constructor(private readonly creatorsService: CreatorsService) {}

  public async resolveTargetOrThrow(target: AffiliateTarget, requirePublishedProduct = true): Promise<{ readonly storeId: string; readonly productId: string | null }> {
    const { productCatalog, storeAccess } = this.creatorsService.dependencies;
    if (target.productId !== undefined) {
      const [product] = await productCatalog.findProductSummaries([target.productId]);
      if (product === undefined || (requirePublishedProduct && !product.published) || (target.storeId !== undefined && product.storeId !== target.storeId)) throw notFound("Product");
      return { storeId: product.storeId, productId: product.id };
    }
    if (target.storeId === undefined) throw unprocessable("Choose a store or a product.");
    const [store] = await storeAccess.findStoreSummaries([target.storeId]);
    if (store === undefined || store.status !== "active") throw notFound("Store");
    return { storeId: store.id, productId: null };
  }

  public async resolveSellerCommissionTarget(principal: Principal, target: AffiliateTarget): Promise<{ readonly storeId: string; readonly productId: string | null }> {
    const { storeAccess } = this.creatorsService.dependencies;
    if (target.productId !== undefined) {
      const resolved = await this.resolveTargetOrThrow(target, false);
      await storeAccess.assertStoreMember(principal.userId, resolved.storeId, COMMISSION_MANAGER_ROLES);
      return resolved;
    }
    return { storeId: await resolveSellerStoreIdForUser(storeAccess, principal.userId, target.storeId, COMMISSION_MANAGER_ROLES), productId: null };
  }

  public async presentAffiliations(creatorId: string): Promise<CreatorAffiliationDto[]> {
    const { affiliates, storeAccess, productCatalog } = this.creatorsService.dependencies;
    const affiliations = await affiliates.listAffiliations(creatorId);
    if (affiliations.length === 0) return [];
    const productIds = affiliations.map((affiliation) => affiliation.productId).filter((id): id is string => id !== null);
    const [stores, products] = await Promise.all([
      storeAccess.findStoreSummaries([...new Set(affiliations.map((affiliation) => affiliation.storeId))]),
      productIds.length === 0 ? Promise.resolve([]) : productCatalog.findProductSummaries(productIds),
    ]);
    return Promise.all(
      affiliations.map(async (affiliation) => {
        const commission = affiliation.productId === null
          ? (await affiliates.listCommissionsForStore(affiliation.storeId)).find((candidate) => candidate.productId === null)
          : await affiliates.findApplicableCommission(affiliation.storeId, affiliation.productId);
        return {
          storeId: affiliation.storeId,
          productId: affiliation.productId,
          storeName: stores.find((store) => store.id === affiliation.storeId)?.name ?? null,
          productTitle: products.find((product) => product.id === affiliation.productId)?.title ?? null,
          commissionBps: commission?.commissionBps ?? null,
          commissionPercent: commission === undefined ? null : commission.commissionBps / 100,
          createdAt: affiliation.createdAt.toISOString(),
        };
      }),
    );
  }
}
