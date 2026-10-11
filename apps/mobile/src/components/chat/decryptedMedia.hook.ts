import type { AttachmentPointer } from "@zudomart/chat-crypto";
import { useEffect, useState } from "react";
import { AppState } from "react-native";

import type { Message } from "@/types";
import { decryptAttachmentInMemory, toDataUri } from "@/services/chatCrypto/encryptedAttachments.service";
import { acquireEphemeralFile, subscribeToDecryptedFileWipes } from "@/services/chatCrypto/ephemeralDecryptedFiles.service";

const isRemoteUrl = (url: string | null | undefined): url is string => !!url && /^https?:\/\//i.test(url);

export const extensionForContentType = (contentType: string) => contentType.split("/")[1]?.split(/[;+]/)[0] ?? "bin";

export function decryptionStrategyFor(message: Pick<Message, "kind" | "media" | "document">): "memory" | "file" | "onOpen" | "none" {
  if (message.document || message.kind === "document") return "onOpen";
  if (message.media?.type === "video") return "file";
  if (message.media) return "memory";
  return "none";
}

function useDecryptedDataUri(mediaId: string, remoteUrl: string | null, pointer: AttachmentPointer | null, enabled: boolean) {
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => {
    setUri(null);
    if (!enabled || !pointer || !remoteUrl) return;
    let isActive = true;
    decryptAttachmentInMemory(mediaId, remoteUrl, pointer).then((bytes) => isActive && setUri(toDataUri(pointer.contentType, bytes)), () => isActive && setUri(null));
    return () => {
      isActive = false;
    };
  }, [enabled, mediaId, remoteUrl, pointer]);
  return uri;
}

function useEphemeralDecryptedFile(mediaId: string, remoteUrl: string | null, pointer: AttachmentPointer | null, enabled: boolean) {
  const [uri, setUri] = useState<string | null>(null);
  const [generation, setGeneration] = useState(0);
  useEffect(() => subscribeToDecryptedFileWipes(() => setGeneration((value) => value + 1)), []);
  useEffect(() => {
    setUri(null);
    if (!enabled || !pointer || !remoteUrl || AppState.currentState === "background") return;
    let isActive = true;
    let release: (() => void) | null = null;
    decryptAttachmentInMemory(mediaId, remoteUrl, pointer).then((bytes) => {
      if (!isActive) return;
      const file = acquireEphemeralFile(mediaId, bytes, extensionForContentType(pointer.contentType));
      release = file.release;
      setUri(file.uri);
    }, () => isActive && setUri(null));
    return () => {
      isActive = false;
      release?.();
    };
  }, [enabled, mediaId, remoteUrl, pointer, generation]);
  return uri;
}

export function useMessageWithDecryptedMedia<T extends Message>(message: T): T {
  const attachment = message.attachment ?? null;
  const remoteUrl = isRemoteUrl(message.media?.url) ? message.media!.url : null;
  const mediaId = message.media?.id ?? message.id;
  const strategy = attachment && remoteUrl ? decryptionStrategyFor(message) : "none";
  const inMemoryUri = useDecryptedDataUri(mediaId, remoteUrl, attachment, strategy === "memory");
  const fileUri = useEphemeralDecryptedFile(mediaId, remoteUrl, attachment, strategy === "file");
  if (!attachment || !remoteUrl || !message.media || strategy === "none" || strategy === "onOpen") return message;
  const placeholder = attachment.thumbnail ? `data:image/jpeg;base64,${attachment.thumbnail}` : null;
  const decryptedUri = strategy === "memory" ? inMemoryUri : fileUri;
  return { ...message, media: { ...message.media, url: decryptedUri ?? (message.kind === "image" ? placeholder : null) } };
}
