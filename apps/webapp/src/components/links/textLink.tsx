"use client";

import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";

import { requestConfirmation } from "@/components/ui/confirmDialog";
import { assessLinkRisk, readDisplayDomain, readInternalPathFromUrl } from "@/utils/postLinks.util";

import styles from "./textLink.module.css";

export async function confirmBeforeOpeningRiskyLink(event: MouseEvent<HTMLAnchorElement>, href: string) {
  const risk = assessLinkRisk(href);
  if (risk === "safe") return;
  event.preventDefault();
  const domain = readDisplayDomain(href);
  const confirmed = await requestConfirmation({
    title: risk === "shortened" ? "Shortened link" : "Suspicious link",
    description: risk === "shortened" ? `This link hides its real destination (${domain}). Only open it if you trust the person who shared it.` : `${domain} looks unusual and may be unsafe. Never enter passwords or payment details.`,
    confirmLabel: "Open anyway",
    tone: "caution",
  });
  if (confirmed) window.open(href, "_blank", "noopener,noreferrer");
}

export function TextLink({ href, children, inverse = false }: { readonly href: string; readonly children: ReactNode; readonly inverse?: boolean }) {
  const className = inverse ? `${styles.link} ${styles.inverse}` : styles.link;
  const internalPath = readInternalPathFromUrl(href);
  if (internalPath) {
    return (
      <Link href={internalPath} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow ugc" className={className} onClick={(event) => void confirmBeforeOpeningRiskyLink(event, href)}>
      {children}
      <span className="visuallyHidden"> (opens in a new tab)</span>
    </a>
  );
}
