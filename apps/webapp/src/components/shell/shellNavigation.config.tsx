import type { ReactNode } from "react";

import {
  BellIcon,
  BookmarkIcon,
  ChatIcon,
  ClipsIcon,
  CompassIcon,
  CreatorIcon,
  HomeIcon,
  LiveIcon,
  OrdersIcon,
  PlusIcon,
  SettingsIcon,
  StoreIcon,
  UserIcon,
} from "@/components/ui/icons";

export interface NavItem {
  readonly href: string;
  readonly label: string;
  readonly icon: ReactNode;
  readonly badgeCount?: number;
}

export interface ShellBadgeCounts {
  readonly cart: number;
  readonly chats: number;
  readonly notifications: number;
}

export function buildSidebarNavigationGroups(isSignedIn: boolean, counts: ShellBadgeCounts): readonly (readonly NavItem[])[] {
  const groups: (readonly NavItem[])[] = [
    [
      { href: "/", label: "Home", icon: <HomeIcon /> },
      { href: "/explore", label: "Explore", icon: <CompassIcon /> },
      { href: "/mart", label: "Mart", icon: <StoreIcon /> },
      { href: "/clips", label: "Clips", icon: <ClipsIcon /> },
      { href: "/live", label: "Live", icon: <LiveIcon /> },
    ],
    [
      { href: "/chats", label: "Messages", icon: <ChatIcon />, badgeCount: counts.chats },
      { href: "/notifications", label: "Notifications", icon: <BellIcon />, badgeCount: counts.notifications },
      { href: "/orders", label: "Orders", icon: <OrdersIcon /> },
      { href: "/saved", label: "Saved", icon: <BookmarkIcon /> },
    ],
    [
      { href: "/creator", label: "Creator", icon: <CreatorIcon /> },
      { href: isSignedIn ? "/me" : "/login", label: "Profile", icon: <UserIcon /> },
      { href: "/settings", label: "Settings", icon: <SettingsIcon /> },
    ],
  ];
  if (!isSignedIn) return [groups[0]!];
  return [[...groups[0]!, { href: "/post/new", label: "Post", icon: <PlusIcon /> }], ...groups.slice(1)];
}

export function buildBottomNavigationItems(isSignedIn: boolean, counts: ShellBadgeCounts): readonly NavItem[] {
  return [
    { href: "/", label: "Home", icon: <HomeIcon /> },
    { href: "/mart", label: "Mart", icon: <StoreIcon /> },
    { href: "/clips", label: "Clips", icon: <ClipsIcon /> },
    ...(isSignedIn ? [{ href: "/post/new", label: "Create", icon: <PlusIcon /> }] : []),
    { href: "/chats", label: "Chats", icon: <ChatIcon />, badgeCount: counts.chats },
    { href: isSignedIn ? "/me" : "/login", label: "Me", icon: <UserIcon /> },
  ];
}

export function isNavItemActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/me") return pathname === "/me";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function formatBadgeCount(count: number): string {
  return count > 99 ? "99+" : String(count);
}
