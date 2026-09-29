import type { UserSummary } from "../../../interfaces/userDirectory.interface.js";
import type { PostDto } from "../../posts/dtos/posts.dto.js";

export interface SocialProofDto {
  readonly friendsLikedCount: number;
  readonly sampleFriends: readonly UserSummary[];
}

export interface FeedItemDto extends PostDto {
  readonly socialProof: SocialProofDto;
}
