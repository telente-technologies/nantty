"use client";

import { decryptAttachment, type GroupAttributes } from "@nantty/chat-crypto";
import { useEffect, useState } from "react";

import type { Conversation } from "@/types";
import { groupPhotoSource } from "@/utils/groupPhoto.util";

export function useGroupPhotoUrl(conversation: Conversation | undefined, attributes: GroupAttributes | null): string | null {
  const source = groupPhotoSource(conversation, attributes);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const url = source?.url ?? null;
  const pointer = source?.pointer ?? null;
  useEffect(() => {
    if (!url || !pointer) return;
    let created: string | null = null;
    let isActive = true;
    fetch(url)
      .then((response) => (response.ok ? response.arrayBuffer() : Promise.reject(new Error("PHOTO_UNAVAILABLE"))))
      .then((buffer) => {
        if (!isActive) return;
        created = URL.createObjectURL(new Blob([decryptAttachment(new Uint8Array(buffer), pointer) as Uint8Array<ArrayBuffer>], { type: pointer.contentType }));
        setObjectUrl(created);
      })
      .catch(() => isActive && setObjectUrl(null));
    return () => {
      isActive = false;
      if (created) URL.revokeObjectURL(created);
      setObjectUrl(null);
    };
  }, [url, pointer]);
  return source ? objectUrl : null;
}
