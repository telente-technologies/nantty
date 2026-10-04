"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AppIcon } from "@/components/ui/appIcon";
import { formatTimeRemaining } from "@/services/copyrightAccount.service";

import styles from "./copyright.module.css";
import { useMyAccountHealth } from "./accountHealth.hook";

export function CopyrightCountdownBanner({ contentId }: { readonly contentId: string }) {
  const { data } = useMyAccountHealth();
  const notice = data?.notices.find((candidate) => candidate.content.id === contentId && candidate.state === "AWAITING_REMOVAL" && candidate.deadlineAt);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!notice) return;
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [notice]);
  if (!notice?.deadlineAt) return null;
  return (
    <div className={styles.banner} role="status">
      <AppIcon name="warning20" size={18} />
      <p>
        <strong>Copyright warning · {formatTimeRemaining(notice.deadlineAt, now)}.</strong> Remove this before the deadline to avoid a strike, or{" "}
        <Link href="/settings/account-status">send a counter-notice</Link>.
      </p>
    </div>
  );
}
