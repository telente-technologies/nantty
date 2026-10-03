import type { AuditLogEntry } from "@/types/audit.type";

export interface CatalogCategory {
  readonly id: string;
  readonly parentId: string | null;
  readonly name: string;
  readonly slug: string;
  readonly iconName: string | null;
  readonly isActive: boolean;
  readonly sortOrder: number;
  readonly productCount: number;
  readonly updatedAt: string;
}

export type ContentTopicStatus = "ACTIVE" | "HIDDEN";

export interface ContentTopic {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly status: ContentTopicStatus;
  readonly isTrending: boolean;
  readonly postCount: number;
  readonly followerCount: number;
  readonly updatedAt: string;
}

export type MartHomeFeatureKind = "HERO_BANNER" | "PROMO_BANNER" | "FEATURED_COLLECTION" | "FEATURED_STORE";
export type MartHomeFeatureTargetType = "CATEGORY" | "COLLECTION" | "STORE" | "PRODUCT" | "URL";
export type MartHomeFeatureStatus = "DRAFT" | "SCHEDULED" | "LIVE" | "EXPIRED";

export interface MartHomeFeature {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string | null;
  readonly kind: MartHomeFeatureKind;
  readonly imageId: string;
  readonly imageUrl: string;
  readonly targetType: MartHomeFeatureTargetType;
  readonly targetValue: string;
  readonly countries: readonly string[];
  readonly startsAt: string;
  readonly endsAt: string | null;
  readonly priority: number;
  readonly isPublished: boolean;
  readonly status: MartHomeFeatureStatus;
  readonly updatedAt: string;
}

export interface MartHomeImageOption {
  readonly id: string;
  readonly label: string;
  readonly url: string;
}

export interface CatalogEntityWithHistory<Entity> {
  readonly item: Entity;
  readonly history: readonly AuditLogEntry[];
}
