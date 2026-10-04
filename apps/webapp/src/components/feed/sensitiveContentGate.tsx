"use client";

import { useEffect, useState, type ReactNode } from "react";

import { AlertIcon } from "@/components/ui/icons";
import { MediaImage } from "@/components/ui/media";
import type { SensitiveContent } from "@/types/postAudience.type";
import { decideSensitiveInterstitialState, describeSensitiveLabels, readSensitiveConsentPostIds, rememberSensitiveConsentForPost } from "@/utils/sensitiveContent.util";

import styles from "./sensitiveContentGate.module.css";

const browserStorage = () => (typeof window === "undefined" ? undefined : window.localStorage);

export function SensitiveContentGate({ postId, sensitive, previewUrl, children }: { readonly postId: string; readonly sensitive: SensitiveContent | null | undefined; readonly previewUrl?: string | null; readonly children: ReactNode }) {
  const [hasConsented, setHasConsented] = useState(false);
  useEffect(() => {
    setHasConsented(readSensitiveConsentPostIds(browserStorage()).includes(postId));
  }, [postId]);
  if (decideSensitiveInterstitialState(sensitive, hasConsented) !== "covered" || !sensitive) return <>{children}</>;
  const titleId = `sensitive-${postId}-title`;
  const description = describeSensitiveLabels(sensitive.labels);
  return (
    <section className={styles.cover} aria-labelledby={titleId} aria-describedby={`${titleId}-message`}>
      {previewUrl ? (
        <span className={styles.preview} aria-hidden="true">
          <MediaImage src={previewUrl} alt="" sizes="(max-width: 768px) 100vw, 640px" />
        </span>
      ) : null}
      <span className={styles.iconBadge} aria-hidden="true">
        <AlertIcon size={22} />
      </span>
      <h3 id={titleId} className={styles.title}>Sensitive content</h3>
      <p id={`${titleId}-message`} className={styles.message}>{description} You can choose whether to see it.</p>
      <button
        type="button"
        className={styles.view}
        aria-label="View sensitive content"
        onClick={() => {
          rememberSensitiveConsentForPost(browserStorage(), postId);
          setHasConsented(true);
        }}
      >
        View
      </button>
    </section>
  );
}
