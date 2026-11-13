export type RightRailModuleName = "wallet" | "suggestedAccounts" | "trending" | "cartSummary";
export type ContentWidth = "reading" | "wide" | "full";
export type RightRailVisibility = "none" | "desktop" | "wideDesktop";

export interface ShellLayoutForRoute {
  readonly contentWidth: ContentWidth;
  readonly rightRailVisibility: RightRailVisibility;
  readonly rightRailModules: readonly RightRailModuleName[];
}

interface RouteLayoutRule extends ShellLayoutForRoute {
  readonly matches: (pathname: string) => boolean;
}

const startsWithAny = (prefixes: readonly string[]) => (pathname: string) =>
  prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

const routeLayoutRules: readonly RouteLayoutRule[] = [
  { matches: (pathname) => pathname === "/", contentWidth: "wide", rightRailVisibility: "desktop", rightRailModules: ["wallet", "suggestedAccounts", "trending"] },
  { matches: startsWithAny(["/post", "/notifications"]), contentWidth: "reading", rightRailVisibility: "desktop", rightRailModules: ["suggestedAccounts", "trending"] },
  { matches: startsWithAny(["/explore"]), contentWidth: "wide", rightRailVisibility: "desktop", rightRailModules: ["trending", "suggestedAccounts"] },
  { matches: startsWithAny(["/mart", "/category", "/collections"]), contentWidth: "wide", rightRailVisibility: "wideDesktop", rightRailModules: ["cartSummary", "wallet"] },
  { matches: startsWithAny(["/me", "/user"]), contentWidth: "wide", rightRailVisibility: "wideDesktop", rightRailModules: ["suggestedAccounts", "trending"] },
  { matches: startsWithAny(["/clips"]), contentWidth: "full", rightRailVisibility: "desktop", rightRailModules: ["suggestedAccounts", "trending"] },
  { matches: startsWithAny(["/chats"]), contentWidth: "full", rightRailVisibility: "none", rightRailModules: [] },
  { matches: startsWithAny(["/settings"]), contentWidth: "reading", rightRailVisibility: "none", rightRailModules: [] },
];

const defaultLayout: ShellLayoutForRoute = { contentWidth: "wide", rightRailVisibility: "none", rightRailModules: [] };

export function describeShellLayoutForPath(pathname: string): ShellLayoutForRoute {
  return routeLayoutRules.find((rule) => rule.matches(pathname)) ?? defaultLayout;
}
