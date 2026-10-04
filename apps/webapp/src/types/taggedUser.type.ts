import type { ID, VerificationColor } from "./models.type";

export interface TaggedUser {
  readonly id: ID;
  readonly username: string;
  readonly displayName: string;
  readonly avatarUrl: string | null;
  readonly checkmark: VerificationColor | null;
  readonly isFollowing?: boolean;
}
