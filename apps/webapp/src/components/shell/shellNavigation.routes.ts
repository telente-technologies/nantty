export const MOBILE_PRIMARY_NAVIGATION_HREFS = ["/", "/clips", "/post/new", "/chats"] as const;

export type BottomNavigationHrefs = readonly [string, string, string, string, string];

export function getBottomNavigationHrefs(isSignedIn: boolean): BottomNavigationHrefs {
  return [...MOBILE_PRIMARY_NAVIGATION_HREFS, isSignedIn ? "/me" : "/login"] as const;
}

export function isNavItemActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/me") return pathname === "/me";
  return pathname === href || pathname.startsWith(`${href}/`);
}
