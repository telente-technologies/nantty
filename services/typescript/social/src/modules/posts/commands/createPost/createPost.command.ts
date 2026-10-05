import type { MentionEntity } from "../../../mentions/models/mention.model.js";
import type { ReplyToComment, StickerLayout } from "../../models/post.model.js";

export interface MediaReferenceInput {
  readonly id: string;
  readonly type: "image" | "video";
  readonly url?: string | null | undefined;
  readonly posterUrl?: string | null | undefined;
  readonly hlsUrl?: string | null | undefined;
  readonly width?: number | undefined;
  readonly height?: number | undefined;
  readonly durationSeconds?: number | undefined;
  readonly blurhash?: string | null | undefined;
}

export interface CreatePostCommand {
  readonly authorId: string;
  readonly kind: "post" | "clip" | "story";
  readonly text: string;
  readonly mediaIds: readonly string[];
  readonly media: readonly MediaReferenceInput[];
  readonly audience: "everyone" | "followers";
  readonly visibility: "public" | "subscribers";
  readonly isAiGenerated: boolean;
  readonly soundId: string | undefined;
  readonly mentions: readonly MentionEntity[] | undefined;
  readonly replyToComment: ReplyToComment | undefined;
  readonly stickerLayout: StickerLayout | undefined;
  readonly replyPolicy?: "everyone" | "following" | "followers" | "mentioned" | "off" | undefined;
  readonly taggedUserIds?: readonly string[] | undefined;
  readonly sensitiveLabels?: readonly string[] | undefined;
}
