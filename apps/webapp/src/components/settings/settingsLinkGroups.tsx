"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { confirmThenSignOut } from "@/components/profile/profileView";
import { useSession } from "@/components/providers/sessionProvider";
import { AppIcon } from "@/components/ui/appIcon";
import { ChevronRightIcon } from "@/components/ui/icons";
import { buildSettingsLinkGroups, type SettingsLink } from "@/utils/settingsLinks.util";

import styles from "./settingsHome.module.css";

function SettingsLinkRow({ link }: { readonly link: SettingsLink }) {
  const content: ReactNode = (
    <>
      <span className={styles.linkIcon}><AppIcon name={link.icon} size={20} /></span>
      <span className={styles.linkText}>
        <span className={styles.linkLabel}>{link.label}</span>
        <span className={styles.linkDescription}>{link.description}</span>
      </span>
      <ChevronRightIcon size={18} />
    </>
  );
  return link.href.startsWith("#") ? <a href={link.href} className={styles.linkRow}>{content}</a> : <Link href={link.href} className={styles.linkRow}>{content}</Link>;
}

export function SettingsLinkGroups() {
  const router = useRouter();
  const { viewer } = useSession();
  return (
    <>
      {buildSettingsLinkGroups(viewer?.isSeller === true).map((group) => (
        <nav key={group.title} className={styles.card} aria-label={group.title}>
          <h2 className={styles.cardTitle}>{group.title}</h2>
          <ul className={styles.linkList}>
            {group.links.map((link) => <li key={link.href}><SettingsLinkRow link={link} /></li>)}
          </ul>
        </nav>
      ))}
      <button
        type="button"
        className={styles.signOutRow}
        onClick={() => void confirmThenSignOut().then((didSignOut) => {
          if (!didSignOut) return;
          router.push("/login");
          router.refresh();
        })}
      >
        <AppIcon name="signOut24" size={20} /> Log out
      </button>
    </>
  );
}
