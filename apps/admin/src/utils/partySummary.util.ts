import type { PartySummary } from "@/types/api.type";

export function toIdentityUser(party: PartySummary): { displayName: string; username: string; avatarUrl: null } {
  return { displayName: party.name ?? party.username ?? "Unknown account", username: party.username ?? party.id, avatarUrl: null };
}
