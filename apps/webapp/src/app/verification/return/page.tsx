"use client";

import { useEffect } from "react";
import Link from "next/link";

import styles from "./return.module.css";

export default function VerificationReturnPage() {
  useEffect(() => {
    if (/android|iphone|ipad|ipod/i.test(navigator.userAgent)) {
      window.location.assign("nantty://settings/verification");
    }
  }, []);

  return (
    <main id="main-content" className={styles.page}>
      <section className={styles.content} aria-labelledby="verification-return-title">
        <p className={styles.eyebrow}>Identity verification</p>
        <h1 id="verification-return-title">Return to Nantty</h1>
        <p className={styles.description}>This page cannot confirm whether you submitted or cancelled the identity check. Your status changes only after Nantty receives Smile ID&apos;s secure verification update.</p>
        <div className={styles.actions}>
          <a className={styles.primaryAction} href="nantty://settings/verification">Open Nantty</a>
          <Link className={styles.secondaryAction} href="/settings/verification">Check status on the web</Link>
        </div>
      </section>
    </main>
  );
}
