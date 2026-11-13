export const MOBILE_PRIMARY_NAVIGATION_HREFS = ["/", "/clips", "/post/new", "/chats"] as const;

export function getBottomNavigationHrefs(isSignedIn: boolean): readonly string[] {
  return [...MOBILE_PRIMARY_NAVIGATION_HREFS, isSignedIn ? "/me" : "/login"];
}

export function isNavItemActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/me") return pathname === "/me";
  return pathname === href || pathname.startsWith(`${href}/`);
}
