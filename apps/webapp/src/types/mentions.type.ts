import type { UserSummary } from "./identityModels.type";
import type { ID } from "./primitive.type";

export const maximumMentionsPerText = 20;

export type MentionSurface = "post" | "comment" | "group";
export type WhoCanMentionMe = "everyone" | "following" | "no_one";

export interface UserMentionEntity {
  readonly userId: ID;
  readonly username: string;
  readonly start: number;
  readonly length: number;
}

export interface EveryoneMentionEntity {
  readonly type: "all";
  readonly start: number;
  readonly length: number;
}

export type MentionEntity = UserMentionEntity | EveryoneMentionEntity;

export interface MentionCandidate {
  readonly user: UserSummary;
  readonly allowsMentions: boolean;
  readonly rank: "following" | "follower" | "recent" | "other" | "member";
}

export interface MentionCandidatesResponse {
  readonly candidates: readonly MentionCandidate[];
  readonly everyone: { readonly available: boolean; readonly unavailableReason: string | null } | null;
}

export interface ResolvedMentionUser {
  readonly username: string | null;
  readonly status: "active" | "suspended" | "deleted";
}

export interface MentionPrivacy {
  readonly whoCanMentionMe: WhoCanMentionMe;
}

export function isUserMentionEntity(entity: MentionEntity): entity is UserMentionEntity {
  return "userId" in entity;
}
