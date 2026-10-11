"use client";

import { type AttachmentPointer, decryptAttachment } from "@zudomart/chat-crypto";
import { useEffect, useState } from "react";

import type { ConversationMessageKind } from "@/types/conversation.type";

import styles from "./messages.module.css";

export function EncryptedAttachment({ url, pointer, kind }: { readonly url: string | null; readonly pointer: AttachmentPointer; readonly kind: ConversationMessageKind }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!url) return;
    let created: string | null = null;
    let isCurrent = true;
    fetch(url, { credentials: url.startsWith("/") ? "same-origin" : "omit", cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("download failed");
        const plaintext = decryptAttachment(new Uint8Array(await response.arrayBuffer()), pointer);
        created = URL.createObjectURL(new Blob([plaintext as BlobPart], { type: pointer.contentType }));
        if (isCurrent) setObjectUrl(created);
      })
      .catch(() => isCurrent && setFailed(true));
    return () => {
      isCurrent = false;
      if (created) URL.revokeObjectURL(created);
    };
  }, [url, pointer]);

  if (!url) return <span>This attachment has expired.</span>;
  if (failed) return <span>This attachment couldn&apos;t be opened.</span>;
  if (!objectUrl) return <span>Decrypting…</span>;
  // eslint-disable-next-line @next/next/no-img-element
  if (kind === "image") return <img src={objectUrl} alt="Photo from the conversation" className={styles.attachmentImage} />;
  if (kind === "video") return <video src={objectUrl} controls className={styles.attachmentImage} />;
  if (kind === "voice") return <audio src={objectUrl} controls />;
  return (
    <a href={objectUrl} download={pointer.fileName ?? "document"}>
      {pointer.fileName ?? "Download document"}
    </a>
  );
}
