"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { ThemeSwitcher } from "@nantty/web-kit";

import { useSession } from "@/components/providers/sessionProvider";
import { SignOutButton } from "@/components/shell/signOutButton";
import { ExpandIcon, ExternalLinkIcon, SettingsIcon } from "@/components/ui/icons";
import { Avatar } from "@/components/ui/media";
import { webappLinks } from "@/config/webappLinks.config";

import styles from "./studioShell.module.css";

export function AccountMenu() {
  const { viewer } = useSession();
  const pathname = usePathname();
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      toggleRef.current?.focus();
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const name = viewer?.name ?? "Creator";

  return (
    <div className={styles.accountMenu} ref={containerRef}>
      {open ? (
        <div className={styles.accountPanel} id={panelId}>
          <div className={styles.accountPanelHead}>
            <strong className={styles.accountName}>{name}</strong>
            <span className={styles.accountHandle}>{viewer?.email ?? viewer?.channelHandle ?? ""}</span>
          </div>
          <ul className={styles.accountLinks}>
            {viewer ? (
              <li>
                <a href={webappLinks.profile(viewer.username)} target="_blank" rel="noopener noreferrer" className={styles.accountLink}>
                  <ExternalLinkIcon size={18} />
                  View your profile
                </a>
              </li>
            ) : null}
            <li>
              <Link href="/settings/account" className={styles.accountLink}>
                <SettingsIcon size={18} />
                Account settings
              </Link>
            </li>
          </ul>
          <div className={styles.accountPanelFoot}>
            <ThemeSwitcher iconOnly />
            <SignOutButton />
          </div>
        </div>
      ) : null}
      <button
        ref={toggleRef}
        type="button"
        className={styles.accountToggle}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((value) => !value)}
        title={name}
      >
        <span className={styles.avatar}>
          <Avatar name={name} src={viewer?.avatarUrl ?? null} size="sm" />
        </span>
        <span className={styles.accountText}>
          <span className={styles.accountName}>{name}</span>
          <span className={styles.accountHandle}>{viewer?.channelHandle ?? ""}</span>
        </span>
        <ExpandIcon size={16} className={styles.accountCaret} />
        <span className="visuallyHidden">Account menu</span>
      </button>
    </div>
  );
}
