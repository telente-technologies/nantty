"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { chatCryptoService } from "@/services/chatCrypto/chatCrypto.service";
import type { ChatLinkPreview } from "@zudomart/chat-crypto";

import styles from "./secureChatNotices.module.css";

export function SecurityCodeChangedBanner({ viewerId, peerIds, peerName }: { readonly viewerId: string; readonly peerIds: readonly string[]; readonly peerName: string }) {
  const queryClient = useQueryClient();
  const [code, setCode] = useState<string | null>(null);
  const changesQuery = useQuery({
    queryKey: ["chatCrypto", "identityChanges", ...peerIds],
    queryFn: async () => {
      await chatCryptoService.ensureReady(viewerId);
      return chatCryptoService.identityChanges(peerIds);
    },
    enabled: viewerId !== "" && peerIds.length > 0,
    refetchInterval: 30_000,
  });
  const changed = changesQuery.data ?? [];
  if (changed.length === 0) return null;
  return (
    <div className={styles.banner} role="status">
      <p>{peerIds.length === 1 ? `${peerName}'s security code changed.` : "A member's security code changed."} This happens when someone reinstalls or adds a device.</p>
      {code ? <p className={styles.code}>{code}</p> : null}
      <div className={styles.actions}>
        {peerIds.length === 1 && !code ? (
          <button type="button" className={styles.action} onClick={() => void chatCryptoService.securityCode(peerIds[0]!).then(setCode)}>
            View code
          </button>
        ) : null}
        <button
          type="button"
          className={styles.action}
          onClick={async () => {
            await Promise.all(changed.map((userId) => chatCryptoService.acknowledgeIdentityChange(userId)));
            await queryClient.invalidateQueries({ queryKey: ["chatCrypto", "identityChanges"] });
          }}
        >
          OK
        </button>
      </div>
    </div>
  );
}

export function EncryptedLinkPreviewCard({ preview }: { readonly preview: ChatLinkPreview }) {
  return (
    <a className={styles.linkCard} href={preview.url} target="_blank" rel="noopener noreferrer nofollow">
      <span className={styles.linkDomain}>{preview.siteName ?? preview.domain}</span>
      <span className={styles.linkTitle}>{preview.title}</span>
      {preview.description ? <span className={styles.linkDescription}>{preview.description}</span> : null}
    </a>
  );
}

export function DecryptionNotice({ text }: { readonly text: string }) {
  return <p className={styles.notice}>{text}</p>;
}
