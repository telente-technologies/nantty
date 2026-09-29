export type CustomAudienceType = "store_customers" | "engagers" | "followers" | "customer_list" | "lookalike";
export type CustomAudienceStatus = "building" | "ready" | "too_small" | "failed";
export type EngagementSource = "any_post" | "clips_watched" | "live_viewers" | "saved_products" | "messaged";
export type HashedIdentifierType = "email" | "phone";

export const MINIMUM_TARGETABLE_AUDIENCE_SIZE = 100;

export interface CustomAudienceDefinition {
  readonly minimumOrders?: number;
  readonly engagementSource?: EngagementSource;
  readonly identifierType?: HashedIdentifierType;
  readonly lookalike?: { readonly sourceAudienceId: string; readonly countryCode: string; readonly similarityPercent: number };
}

export interface CustomAudienceRecord {
  readonly id: string;
  readonly accountId: string;
  readonly name: string;
  readonly type: CustomAudienceType;
  readonly status: CustomAudienceStatus;
  readonly sizeLower: number | null;
  readonly sizeUpper: number | null;
  readonly retentionDays: number | null;
  readonly description: string;
  readonly definition: CustomAudienceDefinition;
  readonly matchedUserIds: readonly string[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export type NewCustomAudienceInput = Omit<CustomAudienceRecord, "id" | "createdAt" | "updatedAt">;
export type CustomAudienceChanges = Partial<Pick<CustomAudienceRecord, "name" | "status" | "sizeLower" | "sizeUpper" | "matchedUserIds">>;
