import type { LinkPreview } from "@/types";
import { findFirstExternalUrl } from "@/components/chat/chatLinks.util";

import { api } from "../core/apiClient.service";

export const buildLinkPreviewOnSenderDevice = async (text: string): Promise<LinkPreview | null> => {
  const url = findFirstExternalUrl(text);
  if (!url) return null;
  try {
    return await api.get<LinkPreview>("/api/v1/link-previews/resolve", { url });
  } catch {
    return null;
  }
};
