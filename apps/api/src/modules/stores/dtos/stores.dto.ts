import type { StoreSummary } from "../../../interfaces/storeAccess.interface.js";
import type { SellerApplicationRecord, StoreMemberRecord, StoreRecord } from "../models/stores.model.js";

export interface StoreDto {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string;
  readonly logoUrl: string | null;
  readonly bannerUrl: string | null;
  readonly status: string;
  readonly featured: boolean;
  readonly shippingPolicy: string;
  readonly returnPolicy: string;
  readonly shippingFee: number;
  readonly discountBps: number;
  readonly currency: string;
  readonly ratingAverage: number;
  readonly ratingCount: number;
  readonly productCount?: number;
  readonly createdAt: string;
}

export function convertStoreToDto(store: StoreRecord, currency: string, productCount?: number): StoreDto {
  return {
    id: store.id,
    name: store.name,
    slug: store.slug,
    description: store.description,
    logoUrl: store.logoUrl,
    bannerUrl: store.bannerUrl,
    status: store.status,
    featured: store.featured,
    shippingPolicy: store.shippingPolicy,
    returnPolicy: store.returnPolicy,
    shippingFee: store.shippingFee,
    discountBps: store.discountBps,
    currency,
    ratingAverage: store.ratingAverage,
    ratingCount: store.ratingCount,
    ...(productCount === undefined ? {} : { productCount }),
    createdAt: store.createdAt.toISOString(),
  };
}

export function convertStoreToSummary(store: StoreRecord): StoreSummary {
  return {
    id: store.id,
    ownerId: store.ownerId,
    name: store.name,
    slug: store.slug,
    logoUrl: store.logoUrl,
    status: store.status,
    shippingFee: store.shippingFee,
    discountBps: store.discountBps,
    ratingAverage: store.ratingAverage,
    ratingCount: store.ratingCount,
  };
}

export function convertStoreMemberToDto(member: StoreMemberRecord) {
  return { storeId: member.storeId, userId: member.userId, role: member.role, createdAt: member.createdAt.toISOString() };
}

export function convertSellerApplicationToDto(application: SellerApplicationRecord, phone: string) {
  return {
    id: application.id,
    userId: application.userId,
    storeName: application.storeName,
    description: application.description,
    categoryId: application.categoryId,
    phone,
    status: application.status,
    reviewNote: application.reviewNote,
    reviewedAt: application.reviewedAt?.toISOString() ?? null,
    createdAt: application.createdAt.toISOString(),
  };
}

export type SellerApplicationDto = ReturnType<typeof convertSellerApplicationToDto>;
