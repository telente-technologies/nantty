import { useEffect, useState } from "react";

import type { Message } from "@/types";
import { resolveDecryptedAttachmentUri } from "@/services/chatCrypto/encryptedAttachments.service";

const isRemoteUrl = (url: string | null | undefined): url is string => !!url && /^https?:\/\//i.test(url);

export function useMessageWithDecryptedMedia<T extends Message>(message: T): T {
  const attachment = message.attachment ?? null;
  const remoteUrl = isRemoteUrl(message.media?.url) ? message.media!.url : isRemoteUrl(message.document?.url) ? message.document!.url : null;
  const mediaId = message.media?.id ?? message.id;
  const [decryptedUri, setDecryptedUri] = useState<string | null>(null);
  useEffect(() => {
    if (!attachment || !remoteUrl) return;
    let isActive = true;
    resolveDecryptedAttachmentUri(mediaId, remoteUrl, attachment).then((uri) => isActive && setDecryptedUri(uri), () => isActive && setDecryptedUri(null));
    return () => {
      isActive = false;
    };
  }, [attachment, remoteUrl, mediaId]);
  if (!attachment || !remoteUrl) return message;
  const placeholder = attachment.thumbnail ? `data:image/jpeg;base64,${attachment.thumbnail}` : null;
  if (message.media) return { ...message, media: { ...message.media, url: decryptedUri ?? (message.kind === "image" ? placeholder : null) } };
  if (message.document) return { ...message, document: { ...message.document, url: decryptedUri } };
  return message;
}
