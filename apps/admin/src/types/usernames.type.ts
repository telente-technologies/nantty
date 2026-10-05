export type ReservedUsernameKind = "EXACT" | "PREFIX" | "PATTERN";
export type ReservedUsernameCategory = "BRAND" | "GOVERNMENT" | "SYSTEM" | "OFFENSIVE" | "PUBLIC_FIGURE";

export interface ReservedUsernameEntry {
  readonly id: string;
  readonly value: string;
  readonly kind: ReservedUsernameKind;
  readonly category: ReservedUsernameCategory;
  readonly note: string | null;
  readonly addedAt: string;
  readonly addedByName: string;
}

export type ReservedUsernameMatchKind = "exact" | "prefix" | "contains" | "brand";

export interface ReservedUsernameRule {
  readonly id: string;
  readonly term: string;
  readonly matchKind: ReservedUsernameMatchKind;
  readonly createdAt?: string;
}

export interface ConfusableCollision {
  readonly entryId: string;
  readonly value: string;
  readonly kind: ReservedUsernameKind;
  readonly category: ReservedUsernameCategory;
  readonly matchedBy: "EXACT" | "SKELETON" | "PREFIX" | "PATTERN";
}

export interface ConfusablePreview {
  readonly candidate: string;
  readonly normalized: string;
  readonly skeleton: string;
  readonly collisions: readonly ConfusableCollision[];
  readonly takenByUserId: string | null;
  readonly takenByUsername: string | null;
  readonly isWithheld: boolean;
}
