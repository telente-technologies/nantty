import type { UserSummary } from "./models.type";

export const MAXIMUM_TAGGED_PEOPLE = 20;

export interface TagCandidate {
  readonly user: UserSummary;
  readonly canTag: boolean;
  readonly unavailableReason: string | null;
}
