import type { VerificationColor } from "./identityModels.type";
import type { ID } from "./primitive.type";

export interface TaggedUser {
  readonly id: ID;
  readonly username: string;
  readonly displayName: string;
  readonly avatarUrl: string | null;
  readonly checkmark: VerificationColor | null;
  readonly isFollowing?: boolean;
}
