import type { ReactNode } from "react";
export { getBottomNavigationHrefs, MOBILE_PRIMARY_NAVIGATION_HREFS, isNavItemActive } from "./shellNavigation.routes";

import {
  BellIcon,
  BookmarkIcon,
  ChatIcon,
  ClipsNavigationIcon,
  CompassIcon,
  CreatorIcon,
  HomeIcon,
  HomeOutlineIcon,
  LiveIcon,
  OrdersIcon,
  PlusIcon,
  ScheduleIcon,
  SettingsIcon,
  SpacesIcon,
  StoreIcon,
  UserIcon,
} from "@/components/ui/icons";

export interface NavItem {
  readonly href: string;
  readonly label: string;
  readonly icon: ReactNode;
  readonly activeIcon?: ReactNode;
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
      { href: "/", label: "Home", icon: <HomeOutlineIcon />, activeIcon: <HomeIcon /> },
      { href: "/explore", label: "Explore", icon: <CompassIcon /> },
      { href: "/mart", label: "Mart", icon: <StoreIcon /> },
      { href: "/clips", label: "Clips", icon: <ClipsNavigationIcon /> },
      { href: "/live", label: "Live", icon: <LiveIcon /> },
      { href: "/spaces", label: "Spaces", icon: <SpacesIcon /> },
    ],
    [
      { href: "/chats", label: "Messages", icon: <ChatIcon />, badgeCount: counts.chats },
      { href: "/notifications", label: "Notifications", icon: <BellIcon />, badgeCount: counts.notifications },
      { href: "/orders", label: "Orders", icon: <OrdersIcon /> },
      { href: "/saved", label: "Saved", icon: <BookmarkIcon /> },
      ...(isSignedIn ? [{ href: "/scheduled", label: "Scheduled", icon: <ScheduleIcon /> }] : []),
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
    { href: "/", label: "Home", icon: <HomeOutlineIcon />, activeIcon: <HomeIcon /> },
    { href: "/clips", label: "Clips", icon: <ClipsNavigationIcon /> },
    { href: "/post/new", label: "Create", icon: <PlusIcon /> },
    { href: "/chats", label: "Chats", icon: <ChatIcon />, badgeCount: counts.chats },
    { href: isSignedIn ? "/me" : "/login", label: "Me", icon: <UserIcon /> },
  ];
}

export function formatBadgeCount(count: number): string {
  return count > 99 ? "99+" : String(count);
}
