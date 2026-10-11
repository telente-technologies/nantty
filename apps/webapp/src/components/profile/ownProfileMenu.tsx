"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import type { ReactNode } from "react";

import menuStyles from "@/components/actions/contentActionsMenu.module.css";
import { AppIcon } from "@/components/ui/appIcon";
import { MoreIcon, SearchIcon, SettingsIcon, WalletIcon } from "@/components/ui/icons";
import { usePopoverMenu } from "@/components/ui/popoverMenu.hook";
import sheetStyles from "@/components/ui/popoverMenu.module.css";
import { composerService } from "@/services/composer.service";
import { creatorProgramService } from "@/services/creatorProgram.service";
import { followsService } from "@/services/posts.service";
import type { User } from "@/types";
import { buildOwnProfileMenuItems, resolveCreatorEntry, type OwnProfileMenuKey } from "@/utils/ownProfileMenu.util";

import styles from "./profileView.module.css";

const menuIcons: Readonly<Record<OwnProfileMenuKey, ReactNode>> = {
  seller: <AppIcon name="buildingStore20" size={20} />,
  creator: <AppIcon name="videoCamera24" size={20} />,
  followRequests: <AppIcon name="userPlus24" size={20} />,
  saved: <AppIcon name="bookmarkSimple24" size={20} />,
  orders: <AppIcon name="package24" size={20} />,
  wallet: <WalletIcon size={20} />,
  verification: <AppIcon name="sealCheck20" size={20} />,
  settings: <SettingsIcon size={20} />,
};

export function OwnProfileHeaderActions({ profile }: { readonly profile: User }) {
  const { isOpen, close, containerRef, triggerRef, menuRef, triggerProps, menuProps } = usePopoverMenu();
  const creatorStatus = useQuery({ queryKey: ["creator", "status", profile.id], queryFn: composerService.fetchMyCreatorStatus, retry: false });
  const application = useQuery({ queryKey: ["creator", "application"], queryFn: () => creatorProgramService.fetchMyCreatorApplication(), retry: false });
  const followRequests = useQuery({ queryKey: ["followRequests", "me"], queryFn: () => followsService.listMyFollowRequests(), retry: false });
  const items = buildOwnProfileMenuItems({
    isSeller: profile.isSeller === true,
    isPrivate: profile.isPrivate === true,
    verificationBadgeVisible: profile.verification?.badgeVisible === true,
    creatorEntry: resolveCreatorEntry(creatorStatus.data?.status, application.data?.status, creatorStatus.isLoading || application.isLoading),
    pendingFollowRequests: followRequests.data?.data.length ?? 0,
    hasMoreFollowRequests: Boolean(followRequests.data?.nextCursor),
  });
  const searchHref = `/explore?${new URLSearchParams({ scope: `profile:${profile.id}`, scopeLabel: `@${profile.username}` }).toString()}`;

  return (
    <div className={styles.ownHeaderActions}>
      <Link href={searchHref} className={styles.iconLink} aria-label={`Search @${profile.username}`}>
        <SearchIcon size={18} />
      </Link>
      <div className={menuStyles.container} ref={containerRef}>
        <button type="button" className={styles.iconLink} aria-label="Profile menu" ref={triggerRef} {...triggerProps}>
          <MoreIcon size={18} />
        </button>
        {isOpen ? <div className={sheetStyles.scrim} aria-hidden="true" onPointerDown={() => close()} /> : null}
        {isOpen ? (
          <div className={`${menuStyles.menu} ${sheetStyles.sheet}`} aria-label="Profile menu" ref={menuRef} {...menuProps}>
            {items.map((item) =>
              item.disabled ? (
                <span key={item.key} role="menuitem" aria-disabled="true" className={`${menuStyles.item} ${styles.menuItemDisabled}`}>
                  {menuIcons[item.key]}
                  <span>{item.label}</span>
                </span>
              ) : (
                <Link key={item.key} href={item.href} role="menuitem" className={menuStyles.item} onClick={() => close(true)}>
                  {menuIcons[item.key]}
                  <span>{item.label}</span>
                  {item.badge ? <span className={styles.menuBadge} aria-label={`${item.badge} pending`}>{item.badge}</span> : null}
                </Link>
              ),
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
