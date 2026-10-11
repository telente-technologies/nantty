"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, ReactNode } from "react";

import { OfflineBanner, ThemeSwitcher, ZudomartWordmark } from "@zudomart/web-kit";

import { CreatorProgramGate } from "@/components/shell/creatorProgramGate";
import { SignOutButton } from "@/components/shell/signOutButton";
import { useSession } from "@/components/providers/sessionProvider";
import { AccountIcon, AudienceIcon, ContentIcon, HomeIcon, LiveIcon, SubscribersIcon, WalletIcon, type IconProps } from "@/components/ui/icons";
import { Avatar } from "@/components/ui/media";

import styles from "./studioShell.module.css";

interface SectionLink {
  readonly href: string;
  readonly label: string;
  readonly icon: ComponentType<IconProps>;
  readonly matches?: readonly string[];
}

export const studioSections: readonly SectionLink[] = [
  { href: "/home", label: "Home", icon: HomeIcon },
  { href: "/content", label: "Content", icon: ContentIcon },
  { href: "/lives", label: "Live", icon: LiveIcon },
  { href: "/earnings", label: "Earnings", icon: WalletIcon },
  { href: "/subscribers", label: "Subscribers", icon: SubscribersIcon },
  { href: "/audience", label: "Audience", icon: AudienceIcon },
  { href: "/account", label: "Account", icon: AccountIcon, matches: ["/embed"] },
];

const isSectionCurrent = (pathname: string, section: SectionLink) =>
  [section.href, ...(section.matches ?? [])].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

export function StudioShell({ children }: { readonly children: ReactNode }) {
  const { viewer } = useSession();
  const pathname = usePathname();
  const isSignedInWithoutCreatorAccess = viewer !== null && !viewer.isCreator;

  return (
    <div className={styles.shell}>
      <OfflineBanner />
      <header className={styles.topBar}>
        <Link href="/home" className={styles.brand} aria-label="Zudomart Studio home">
          <ZudomartWordmark productLabel="Studio" height={20} withSymbol collapseToMarkOnSmallScreens />
        </Link>
        {isSignedInWithoutCreatorAccess ? null : (
          <nav className={styles.navLinks} aria-label="Studio sections">
            {studioSections.map((section) => {
              const Icon = section.icon;
              return (
                <Link key={section.href} href={section.href} className={styles.navLink} aria-current={isSectionCurrent(pathname, section) ? "page" : undefined}>
                  <Icon size={18} />
                  {section.label}
                </Link>
              );
            })}
          </nav>
        )}
        <div className={styles.account}>
          <ThemeSwitcher iconOnly className={styles.themeSwitcher} />
          <span className={styles.avatar}>
            <Avatar name={viewer?.name ?? "Creator"} src={viewer?.avatarUrl ?? null} size="sm" />
          </span>
          <span className={styles.accountText}>
            <span className={styles.accountName}>{viewer?.name ?? "Creator"}</span>
            <span className={styles.accountHandle}>{viewer?.channelHandle ?? ""}</span>
          </span>
          <SignOutButton />
        </div>
      </header>
      <main id="main-content" className={styles.main} tabIndex={-1}>
        {isSignedInWithoutCreatorAccess ? <CreatorProgramGate /> : children}
      </main>
    </div>
  );
}
