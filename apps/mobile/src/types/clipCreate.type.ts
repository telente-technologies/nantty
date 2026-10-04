import type { ID } from "./models.type";

export type ClipTransition = "none" | "crossfade" | "slide";

export interface ClipMediaTrim {
  readonly startMs: number;
  readonly endMs: number;
}

export interface ClipMediaInput {
  readonly mediaId: ID;
  readonly type: "image" | "video";
  readonly trim?: ClipMediaTrim;
}

export interface ClipSlideshowInput {
  readonly durationsMs: readonly number[];
  readonly transition: ClipTransition;
}

export interface PostLocationTag {
  readonly placeId: string;
  readonly name: string;
  readonly area?: string | null;
}
