import type { CreatorProgramStatus } from "@/types";

export type OwnProfileMenuKey = "seller" | "creator" | "ads" | "followRequests" | "saved" | "orders" | "wallet" | "verification" | "settings";

export interface OwnProfileMenuItem {
  readonly key: OwnProfileMenuKey;
  readonly label: string;
  readonly href: string;
  readonly disabled?: boolean;
  readonly badge?: string;
}

export interface CreatorEntry {
  readonly label: string;
  readonly href: string;
  readonly isLoading: boolean;
}

export function resolveCreatorEntry(creatorStatus: CreatorProgramStatus | undefined, applicationStatus: string | null | undefined, isLoading: boolean): CreatorEntry {
  const personalStatus = creatorStatus ?? "none";
  const effectiveStatus = personalStatus === "none" ? applicationStatus ?? "none" : personalStatus;
  if (effectiveStatus === "approved") return { label: "Creator tools", href: "/creator", isLoading };
  if (effectiveStatus === "pending" || effectiveStatus === "rejected") return { label: "Creator application status", href: "/creator/apply", isLoading };
  return { label: "Switch to creator account", href: "/creator/program", isLoading };
}

export interface OwnProfileMenuInput {
  readonly userId?: string;
  readonly isSeller: boolean;
  readonly isPrivate: boolean;
  readonly verificationBadgeVisible: boolean;
  readonly creatorEntry: CreatorEntry;
  readonly pendingFollowRequests: number;
  readonly hasMoreFollowRequests?: boolean;
}

export function buildOwnProfileMenuItems({ isSeller, isPrivate, verificationBadgeVisible, creatorEntry, pendingFollowRequests, hasMoreFollowRequests }: OwnProfileMenuInput): OwnProfileMenuItem[] {
  const showFollowRequests = isPrivate || pendingFollowRequests > 0;
  const followRequestsBadge = pendingFollowRequests > 0 ? `${pendingFollowRequests}${hasMoreFollowRequests ? "+" : ""}` : undefined;
  return [
    ...(isSeller ? [{ key: "seller", label: "Seller dashboard", href: "/seller" } as const] : []),
    { key: "creator", label: creatorEntry.label, href: creatorEntry.href, disabled: creatorEntry.isLoading },
    { key: "ads", label: "Ads", href: "/ads" },
    ...(showFollowRequests ? [{ key: "followRequests", label: "Follow requests", href: "/me/follow-requests", badge: followRequestsBadge } as const] : []),
    { key: "saved", label: "Saved", href: "/saved" },
    { key: "orders", label: "My orders", href: "/orders" },
    { key: "wallet", label: "Wallet", href: "/wallet" },
    { key: "verification", label: verificationBadgeVisible ? "Verification" : "Get verified", href: "/verification" },
    { key: "settings", label: "Settings", href: "/settings" },
  ];
}
