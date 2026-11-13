import type { Comment } from "@/types";
import { buildProfilePath } from "@/utils/seoPaths.util";

/** Managed-profile comments belong to the selected profile, not its owner's profile. */
export function commentAuthorProfileHref(comment: Pick<Comment, "author" | "postedAs">): string {
  return buildProfilePath(comment.postedAs?.handle ?? comment.author.username);
}
