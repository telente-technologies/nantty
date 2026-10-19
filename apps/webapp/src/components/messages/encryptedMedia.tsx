"use client";

import { type AttachmentPointer, decryptAttachment } from "@zudomart/chat-crypto";
import { useEffect, useState } from "react";

import { VoiceNoteBubble } from "./voiceNoteBubble";

const decryptedUrls = new Map<string, Promise<string>>();

function decryptToObjectUrl(cacheKey: string, url: string, pointer: AttachmentPointer): Promise<string> {
  let pending = decryptedUrls.get(cacheKey);
  if (!pending) {
    pending = fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error("ATTACHMENT_UNAVAILABLE");
        return response.arrayBuffer();
      })
      .then((buffer) => URL.createObjectURL(new Blob([decryptAttachment(new Uint8Array(buffer), pointer) as Uint8Array<ArrayBuffer>], { type: pointer.contentType })));
    decryptedUrls.set(cacheKey, pending);
    pending.catch(() => decryptedUrls.delete(cacheKey));
  }
  return pending;
}

export function useDecryptedMediaUrl(cacheKey: string, url: string | null | undefined, pointer: AttachmentPointer | null | undefined): { readonly url: string | null; readonly failed: boolean } {
  const [state, setState] = useState<{ url: string | null; failed: boolean }>({ url: null, failed: false });
  useEffect(() => {
    if (!url || !pointer) return;
    let isActive = true;
    decryptToObjectUrl(cacheKey, url, pointer).then(
      (objectUrl) => isActive && setState({ url: objectUrl, failed: false }),
      () => isActive && setState({ url: null, failed: true }),
    );
    return () => {
      isActive = false;
    };
  }, [cacheKey, url, pointer]);
  if (!pointer) return { url: url ?? null, failed: false };
  return state.url ? state : { url: pointer.thumbnail && !state.failed ? `data:image/jpeg;base64,${pointer.thumbnail}` : null, failed: state.failed };
}

interface EncryptedMediaProps {
  readonly cacheKey: string;
  readonly type: "image" | "video" | "voice";
  readonly url: string | null;
  readonly pointer: AttachmentPointer | null | undefined;
  readonly className?: string;
  readonly isMine?: boolean;
  readonly durationSeconds?: number;
}

export function EncryptedMedia({ cacheKey, type, url, pointer, className, isMine = false, durationSeconds }: EncryptedMediaProps) {
  const resolved = useDecryptedMediaUrl(cacheKey, url, pointer);
  if (resolved.failed) return <p className={className}>This attachment couldn&apos;t be decrypted.</p>;
  if (type === "voice") {
    return <VoiceNoteBubble mediaId={cacheKey} source={resolved.url} durationSeconds={pointer?.durationSeconds ?? durationSeconds ?? 0} waveformPeaks={pointer?.waveform} isMine={isMine} />;
  }
  if (!resolved.url) return null;
  if (type === "image") return <img src={resolved.url} alt="Photo" className={className} loading="lazy" />;
  return <video src={resolved.url} controls className={className} preload="metadata" />;
}
