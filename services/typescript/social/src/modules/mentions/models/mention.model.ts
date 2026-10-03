export interface UserMentionEntity {
  readonly userId: string;
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

export const isAllMention = (entity: MentionEntity): entity is AllMentionEntity => "type" in entity && entity.type === "all";
