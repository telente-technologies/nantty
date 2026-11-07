export const invitationLinkExpiryOptions = [
  { hours: 24, label: "24 hours" },
  { hours: 168, label: "7 days" },
  { hours: 720, label: "30 days" },
] as const;

export type InvitationLinkExpiryHours = (typeof invitationLinkExpiryOptions)[number]["hours"];
export const DEFAULT_INVITATION_LINK_EXPIRY_HOURS: InvitationLinkExpiryHours = 168;
export type InvitationLinkStatus = "active" | "expired" | "revoked" | "unknown";

export function invitationLinkExpiryLabel(hours: InvitationLinkExpiryHours): string {
  return invitationLinkExpiryOptions.find((option) => option.hours === hours)?.label ?? `${hours} hours`;
}

export function invitationLinkStatus(expiresAt: string, revokedAt: string | null, now = Date.now()): InvitationLinkStatus {
  if (revokedAt) return "revoked";
  const expiresAtMs = Date.parse(expiresAt);
  if (!Number.isFinite(expiresAtMs)) return "unknown";
  return expiresAtMs <= now ? "expired" : "active";
}
