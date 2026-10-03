"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { ThemeSwitcher } from "@zudomart/web-kit";

import { useSession } from "@/components/providers/sessionProvider";
import { signOut } from "@/components/profile/profileView";
import { BookmarkIcon, CreatorIcon, LogOutIcon, OrdersIcon, SettingsIcon, UserIcon } from "@/components/ui/icons";
import { Avatar } from "@/components/ui/media";

import styles from "./userMenu.module.css";

export function UserMenu() {
  const { viewer } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setIsOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

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
    { href: "/creator", label: "Creator dashboard", icon: <CreatorIcon size={18} /> },
    { href: "/settings", label: "Settings", icon: <SettingsIcon size={18} /> },
  ];

  return (
    <div className={styles.container} ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-expanded={isOpen}
        aria-controls={menuId}
        aria-label="Account menu"
        onClick={() => setIsOpen((open) => !open)}
      >
        <Avatar name={viewer.name} src={viewer.avatarUrl ?? null} size="sm" />
      </button>
      {isOpen ? (
        <div className={styles.panel} id={menuId}>
          <Link href="/me" className={styles.identity}>
            <Avatar name={viewer.name} src={viewer.avatarUrl ?? null} size="md" />
            <span className={styles.identityText}>
              <span className={styles.identityName}>{viewer.name}</span>
              <span className={styles.identityHandle}>@{viewer.username}</span>
            </span>
          </Link>
          <ul className={styles.links}>
            {menuLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className={styles.link}>
                  {link.icon}
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className={styles.themeRow}>
            <ThemeSwitcher label="Appearance" showLabel />
          </div>
          <button
            type="button"
            className={styles.link}
            onClick={() => {
              signOut().finally(() => {
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
