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
  readonly quotedPostId?: string | null;
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

const draftStorageKey = (viewerId: string, quoteSlot?: string | null) => (quoteSlot ? `zudomart.composerDraft.${viewerId}.quote.${quoteSlot}` : `zudomart.composerDraft.${viewerId}`);

export const isComposerDraftEmpty = (draft: ComposerDraft) =>
  draft.text.trim() === "" && draft.tagged.length === 0 && draft.products.length === 0 && draft.sensitiveLabels.length === 0 && draft.location === null && !draft.quotedPostId;

const quoteParamPattern = /^[A-Za-z0-9_-]{1,64}$/;

export const readQuoteParam = (value: string | null | undefined): string | null => (value && quoteParamPattern.test(value) ? value : null);

function readSavedLocation(value: unknown): PostLocationTag | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<PostLocationTag>;
  if (typeof candidate.placeId !== "string" || typeof candidate.name !== "string" || !candidate.placeId || !candidate.name) return null;
  return { placeId: candidate.placeId.slice(0, 200), name: candidate.name.slice(0, 120), area: typeof candidate.area === "string" ? candidate.area.slice(0, 120) : null };
}

export function readSavedComposerDraft(storage: Pick<Storage, "getItem"> | undefined, viewerId: string, quoteSlot?: string | null): ComposerDraft | null {
  try {
    const raw = storage?.getItem(draftStorageKey(viewerId, quoteSlot));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ComposerDraft>;
    if (typeof parsed.text !== "string") return null;
    return { ...EMPTY_COMPOSER_DRAFT, ...parsed, text: parsed.text.slice(0, PREMIUM_POST_TEXT_LIMIT), location: readSavedLocation(parsed.location), quotedPostId: readQuoteParam(parsed.quotedPostId) };
  } catch {
    return null;
  }
}

export function saveComposerDraft(storage: Pick<Storage, "setItem" | "removeItem"> | undefined, viewerId: string, draft: ComposerDraft, quoteSlot?: string | null): void {
  try {
    const key = draftStorageKey(viewerId, quoteSlot);
    if (isComposerDraftEmpty(draft) || (quoteSlot && draft.text.trim() === "" && draft.tagged.length === 0 && draft.products.length === 0 && draft.location === null)) storage?.removeItem(key);
    else storage?.setItem(key, JSON.stringify(draft));
  } catch {
    return;
  }
}

export function clearSavedComposerDraft(storage: Pick<Storage, "removeItem"> | undefined, viewerId: string, quoteSlot?: string | null): void {
  try {
    storage?.removeItem(draftStorageKey(viewerId, quoteSlot));
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
