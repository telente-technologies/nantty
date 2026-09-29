import { StoreRole } from "../../../constants/roles.constant.js";
import { forbidden, notFound } from "../../../errors/domain.error.js";
import type { StoreAccess, StoreSummary } from "../../../interfaces/storeAccess.interface.js";
import { convertStoreToSummary } from "../dtos/stores.dto.js";
import type { StoresRepository } from "../repositories/stores.repository.js";

export class StoreAccessService implements StoreAccess {
  public constructor(private readonly stores: StoresRepository) {}

  public async assertStoreMember(userId: string, storeId: string, allowedRoles?: readonly StoreRole[]): Promise<void> {
    if ((await this.stores.findById(storeId)) === undefined) throw notFound("Store");
    const member = await this.stores.findMember(storeId, userId);
    if (member === undefined) throw forbidden("You are not a member of this store.");
    if (allowedRoles !== undefined && !allowedRoles.includes(member.role)) throw forbidden("Your store role does not allow this.");
  }

  public assertStoreOwner(userId: string, storeId: string): Promise<void> {
    return this.assertStoreMember(userId, storeId, [StoreRole.OWNER]);
  }

  public assertStoreManager(userId: string, storeId: string): Promise<void> {
    return this.assertStoreMember(userId, storeId, [StoreRole.OWNER, StoreRole.MANAGER]);
  }

  public listStoreIdsForMember(userId: string): Promise<readonly string[]> {
    return this.stores.listStoreIdsForMember(userId);
  }

  public async findPrimaryStoreIdForMember(userId: string): Promise<string | undefined> {
    const memberStoreIds = await this.stores.listStoreIdsForMember(userId);
    const memberStores = await this.stores.findManyByIds(memberStoreIds);
    const ownedStores = memberStores
      .filter((store) => store.ownerId === userId)
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
    return ownedStores[0]?.id ?? memberStoreIds[0];
  }

  public async findStoreSummaries(storeIds: readonly string[]): Promise<readonly StoreSummary[]> {
    return (await this.stores.findManyByIds([...new Set(storeIds)])).map(convertStoreToSummary);
  }

  public updateStoreRating(storeId: string, ratingAverage: number, ratingCount: number): Promise<void> {
    return this.stores.updateRating(storeId, ratingAverage, ratingCount);
  }
}
