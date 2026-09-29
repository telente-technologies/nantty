import type { StatusTone } from "@/components/ui/statusBadge";
import type { BrandClaimKind, BrandClaimStatus, BrandMemberRole, BrandRegistrationStatus, OfficialStoreStatus } from "@/types/brand.type";

export const brandRegistrationLabels: Record<BrandRegistrationStatus, { label: string; tone: StatusTone }> = {
  unregistered: { label: "Not registered", tone: "neutral" },
  pending: { label: "Registration pending", tone: "caution" },
  registered: { label: "Registered brand", tone: "success" },
  rejected: { label: "Registration rejected", tone: "error" },
};

export const officialStoreLabels: Record<OfficialStoreStatus, { label: string; tone: StatusTone }> = {
  not_eligible: { label: "Not eligible yet", tone: "neutral" },
  eligible: { label: "Ready to apply", tone: "info" },
  active: { label: "Official Store", tone: "highlight" },
  suspended: { label: "Official Store paused", tone: "error" },
};

export const brandMemberRoleLabels: Record<BrandMemberRole, string> = { owner: "Owner", admin: "Admin", editor: "Editor", viewer: "Viewer" };

export const brandMemberRoleDescriptions: Record<Exclude<BrandMemberRole, "owner">, string> = {
  admin: "Manages the team, stores, Official Store and brand claims.",
  editor: "Edits the brand profile, logo and cover.",
  viewer: "Sees the brand and its reports.",
};

export const brandClaimKindLabels: Record<BrandClaimKind, string> = { counterfeit: "Counterfeit goods", trademark: "Trademark misuse", unauthorised_seller: "Unauthorised seller" };

export const brandClaimStatusLabels: Record<BrandClaimStatus, { label: string; tone: StatusTone }> = {
  submitted: { label: "Submitted", tone: "info" },
  under_review: { label: "Under review", tone: "caution" },
  upheld: { label: "Upheld — listings removed", tone: "success" },
  rejected: { label: "Rejected", tone: "error" },
  withdrawn: { label: "Withdrawn", tone: "neutral" },
};

export function canBrandRoleManage(role: BrandMemberRole | null | undefined): boolean {
  return role === "owner" || role === "admin";
}

export function canBrandRoleEditProfile(role: BrandMemberRole | null | undefined): boolean {
  return role === "owner" || role === "admin" || role === "editor";
}
