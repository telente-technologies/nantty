import type { LinkPreviewView } from "../modules/linkPreviews/models/linkPreview.model.js";

export interface LinkUnfurler {
  resolveLinkPreview(rawUrl: string): Promise<LinkPreviewView | null>;
  attachLinkPreviewToPost(postId: string, text: string): Promise<LinkPreviewView | null>;
}
