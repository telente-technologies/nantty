import type { Comment, VerificationColor } from "@/types";

export function commentVerificationColor(comment: Pick<Comment, "author" | "postedAs">): VerificationColor | null {
  if (comment.postedAs) return comment.postedAs.checkmark ?? null;
  if (comment.author.verification?.badgeVisible) return comment.author.verification.color;
  return comment.author.verified ? "blue" : null;
}
