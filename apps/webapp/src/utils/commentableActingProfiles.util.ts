import type { ActingProfile } from "@/types/brand.type";

export function commentableActingProfiles(profiles: readonly ActingProfile[]): ActingProfile[] {
  return profiles.filter(
    (profile) =>
      (profile.kind === "business" || profile.kind === "brand" || profile.kind === "store") &&
      profile.onHold !== true,
  );
}
