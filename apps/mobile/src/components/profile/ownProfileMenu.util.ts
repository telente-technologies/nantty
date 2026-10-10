import type { CreatorEntryRoute } from "@/hooks/useCreatorStatus.hook";
import type { User } from "@/types";

export type OwnProfileMenuIcon = "seller" | "creator" | "followRequests" | "saved" | "orders" | "wallet" | "verification" | "settings";

export type OwnProfileMenuRoute =
  | "SellerDashboard"
  | CreatorEntryRoute
  | "FollowRequests"
  | "Saved"
  | "Orders"
  | "Wallet"
  | "Verification"
  | "Settings";

export interface OwnProfileMenuItem {
  readonly key: OwnProfileMenuIcon;
  readonly label: string;
  readonly route: OwnProfileMenuRoute;
  readonly disabled?: boolean;
  readonly badge?: string;
}

export interface OwnProfileMenuInput {
  readonly profile: Pick<User, "isSeller" | "isPrivate" | "verification">;
  readonly creatorEntry: { readonly label: string; readonly route: CreatorEntryRoute; readonly isLoading: boolean };
  readonly pendingFollowRequests: number;
  readonly hasMoreFollowRequests?: boolean;
}

export function buildOwnProfileMenuItems({ profile, creatorEntry, pendingFollowRequests, hasMoreFollowRequests }: OwnProfileMenuInput): OwnProfileMenuItem[] {
  const showFollowRequests = Boolean(profile.isPrivate) || pendingFollowRequests > 0;
  const followRequestsBadge = pendingFollowRequests > 0 ? `${pendingFollowRequests}${hasMoreFollowRequests ? "+" : ""}` : undefined;
  return [
    ...(profile.isSeller ? [{ key: "seller", label: "Seller dashboard", route: "SellerDashboard" } as const] : []),
    { key: "creator", label: creatorEntry.label, route: creatorEntry.route, disabled: creatorEntry.isLoading },
    ...(showFollowRequests ? [{ key: "followRequests", label: "Follow requests", route: "FollowRequests", badge: followRequestsBadge } as const] : []),
    { key: "saved", label: "Saved", route: "Saved" },
    { key: "orders", label: "My orders", route: "Orders" },
    { key: "wallet", label: "Wallet", route: "Wallet" },
    { key: "verification", label: profile.verification?.badgeVisible ? "Verification" : "Get verified", route: "Verification" },
    { key: "settings", label: "Settings", route: "Settings" },
  ];
}
