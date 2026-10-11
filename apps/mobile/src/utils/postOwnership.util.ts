import type { ID } from "@/types";

export interface OwnableContent {
  readonly author: { readonly id: ID };
  readonly postedAs?: { readonly id: ID } | null;
}

export function isContentOwnedBy(content: OwnableContent, viewerId: ID | null | undefined, actingProfileId: ID | null | undefined): boolean {
  if (viewerId && content.author.id === viewerId) return true;
  return !!content.postedAs && !!actingProfileId && content.postedAs.id === actingProfileId;
}
