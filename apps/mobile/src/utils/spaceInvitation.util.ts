import type { SpaceInvitationRole } from "@/services/spaces.service";

export const spaceInvitationRoleLabel = (role: SpaceInvitationRole): string => {
  switch (role) {
    case "moderator":
    case "cohost":
      return "Co-host";
    case "speaker":
      return "Speaker";
    case "listener":
      return "Listener";
  }
};
