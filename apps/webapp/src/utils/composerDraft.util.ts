import type { ReplyPolicy, SensitiveLabel } from "@/types/postAudience.type";
import type { PostAudience, PostLocationTag, UserSummary } from "@/types";

import type { MentionDraft } from "./mentions.util";

export const FREE_POST_TEXT_LIMIT = 280;
export const PREMIUM_POST_TEXT_LIMIT = 2000;

export interface ComposerTaggedProduct {
  readonly id: string;
  readonly name: string;
  readonly imageUrl: string | null;
}

export interface ComposerDraft {
  readonly text: string;
  readonly mentions: readonly MentionDraft[];
  readonly audience: PostAudience;
  readonly replyPolicy: ReplyPolicy;
  readonly visibility: "public" | "subscribers";
  readonly sensitiveLabels: readonly SensitiveLabel[];
  readonly isAiGenerated: boolean;
  readonly tagged: readonly UserSummary[];
  readonly products: readonly ComposerTaggedProduct[];
  readonly location: PostLocationTag | null;
}

export const EMPTY_COMPOSER_DRAFT: ComposerDraft = {
  text: "",
  mentions: [],
  audience: "everyone",
  replyPolicy: "everyone",
  visibility: "public",
  sensitiveLabels: [],
  isAiGenerated: false,
  tagged: [],
  products: [],
  location: null,
};

const draftStorageKey = (viewerId: string) => `zudomart.composerDraft.${viewerId}`;

export const isComposerDraftEmpty = (draft: ComposerDraft) =>
  draft.text.trim() === "" && draft.tagged.length === 0 && draft.products.length === 0 && draft.sensitiveLabels.length === 0 && draft.location === null;

function readSavedLocation(value: unknown): PostLocationTag | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<PostLocationTag>;
  if (typeof candidate.placeId !== "string" || typeof candidate.name !== "string" || !candidate.placeId || !candidate.name) return null;
  return { placeId: candidate.placeId.slice(0, 200), name: candidate.name.slice(0, 120), area: typeof candidate.area === "string" ? candidate.area.slice(0, 120) : null };
}

export function readSavedComposerDraft(storage: Pick<Storage, "getItem"> | undefined, viewerId: string): ComposerDraft | null {
  try {
    const raw = storage?.getItem(draftStorageKey(viewerId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ComposerDraft>;
    if (typeof parsed.text !== "string") return null;
    return { ...EMPTY_COMPOSER_DRAFT, ...parsed, text: parsed.text.slice(0, PREMIUM_POST_TEXT_LIMIT), location: readSavedLocation(parsed.location) };
  } catch {
    return null;
  }
}

export function saveComposerDraft(storage: Pick<Storage, "setItem" | "removeItem"> | undefined, viewerId: string, draft: ComposerDraft): void {
  try {
    if (isComposerDraftEmpty(draft)) storage?.removeItem(draftStorageKey(viewerId));
    else storage?.setItem(draftStorageKey(viewerId), JSON.stringify(draft));
  } catch {
    return;
  }
}

export function clearSavedComposerDraft(storage: Pick<Storage, "removeItem"> | undefined, viewerId: string): void {
  try {
    storage?.removeItem(draftStorageKey(viewerId));
  } catch {
    return;
  }
}

export function describePublishButton(isPending: boolean, combinedUploadedFraction: number): string {
  if (isPending && combinedUploadedFraction < 1) return `Uploading ${Math.round(combinedUploadedFraction * 100)}%…`;
  return isPending ? "Posting…" : "Post";
}

export function canPublishComposerDraft(draft: ComposerDraft, mediaCount: number, textLimit: number): boolean {
  const hasContent = draft.text.trim().length > 0 || mediaCount > 0;
  return hasContent && draft.text.length <= textLimit;
}
