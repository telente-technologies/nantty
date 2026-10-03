import type { ID, UserSummary } from "./models.type";

export interface UserMentionEntity {
  readonly userId: ID;
  readonly username: string;
  readonly start: number;
  readonly length: number;
}

export interface AllMentionEntity {
  readonly type: "all";
  readonly start: number;
  readonly length: number;
}

export type MentionEntity = UserMentionEntity | AllMentionEntity;

export type MentionSurface = "post" | "comment" | "group" | "direct";

export type WhoCanMentionMe = "everyone" | "following" | "no_one";

export interface MentionCandidate {
  readonly user: UserSummary;
  readonly allowsMentions: boolean;
  readonly rank: "following" | "follower" | "recent" | "other" | "member";
}

export interface MentionEveryoneOption {
  readonly available: boolean;
  readonly unavailableReason: string | null;
}

export interface MentionCandidatesResponse {
  readonly candidates: readonly MentionCandidate[];
  readonly everyone: MentionEveryoneOption | null;
}

export type MentionTargetStatus = "active" | "suspended" | "deleted";

export interface MentionTarget {
  readonly username: string | null;
  readonly status: MentionTargetStatus;
}

export type MentionTargetsByUserId = Readonly<Record<ID, MentionTarget>>;

export interface MentionPrivacySettings {
  readonly whoCanMentionMe: WhoCanMentionMe;
}

export interface MentionDraft {
  readonly text: string;
  readonly mentions: readonly MentionEntity[];
}
