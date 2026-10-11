"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { ThemeSwitcher } from "@zudomart/web-kit";

import { useSession } from "@/components/providers/sessionProvider";
import { confirmThenSignOut } from "@/components/profile/profileView";
import { BookmarkIcon, CreatorIcon, LogOutIcon, OrdersIcon, SettingsIcon, UserIcon } from "@/components/ui/icons";
import { Avatar } from "@/components/ui/media";
import { usePopoverMenu } from "@/components/ui/popoverMenu.hook";
import sheetStyles from "@/components/ui/popoverMenu.module.css";

import styles from "./userMenu.module.css";

export function UserMenu() {
  const { viewer } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const { isOpen: menuIsOpen, close: menuClose, containerRef: menuContainerRef, triggerRef: menuTriggerRef, menuRef: menuMenuRef, triggerProps: menuTriggerProps, menuProps: menuMenuProps } = usePopoverMenu({ closeOnTab: false });

  useEffect(() => {
    menuClose();
  }, [pathname, menuClose]);

  if (!viewer) {
    return (
      <Link href="/login" className={styles.signInLink}>
        Sign in
      </Link>
    );
  }

  const menuLinks = [
    { href: "/me", label: "Your profile", icon: <UserIcon size={18} /> },
    { href: "/saved", label: "Saved", icon: <BookmarkIcon size={18} /> },
    { href: "/orders", label: "Orders", icon: <OrdersIcon size={18} /> },
    { href: "/creator", label: "Creator tools", icon: <CreatorIcon size={18} /> },
    { href: "/settings", label: "Settings", icon: <SettingsIcon size={18} /> },
  ];

  return (
    <div className={styles.container} ref={menuContainerRef}>
      <button type="button" className={styles.trigger} aria-label="Account menu" ref={menuTriggerRef} {...menuTriggerProps}>
        {viewer.avatarUrl ? <Avatar name={viewer.name} src={viewer.avatarUrl} size="sm" /> : <UserIcon size={22} />}
      </button>
      {menuIsOpen ? <div className={sheetStyles.scrim} aria-hidden="true" onPointerDown={() => menuClose()} /> : null}
      {menuIsOpen ? (
        <div className={`${styles.panel} ${sheetStyles.sheet}`} aria-label="Account" ref={menuMenuRef} {...menuMenuProps}>
          <Link href="/me" role="menuitem" className={styles.identity}>
            <Avatar name={viewer.name} src={viewer.avatarUrl ?? null} size="md" />
            <span className={styles.identityText}>
              <span className={styles.identityName}>{viewer.name}</span>
              <span className={styles.identityHandle}>@{viewer.username}</span>
            </span>
          </Link>
          <div className={styles.links} role="group">
            {menuLinks.map((link) => (
              <Link key={link.href} href={link.href} role="menuitem" className={styles.link}>
                {link.icon}
                {link.label}
              </Link>
            ))}
          </div>
          <div className={styles.themeRow}>
            <ThemeSwitcher label="Appearance" showLabel />
          </div>
          <button
            type="button"
            role="menuitem"
            className={styles.link}
            onClick={() => {
              menuClose(true);
              void confirmThenSignOut().then((didSignOut) => {
                if (!didSignOut) return;
                router.push("/login");
                router.refresh();
              });
            }}
          >
            <LogOutIcon size={18} />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
