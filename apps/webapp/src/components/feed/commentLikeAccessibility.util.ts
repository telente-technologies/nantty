export function describeCommentLikeAccessibility(isLiked: boolean, formattedLikeCount: string, authorName: string) {
  return {
    label: `${isLiked ? "Unlike" : "Like"} comment by ${authorName}, ${formattedLikeCount} ${formattedLikeCount === "1" ? "like" : "likes"}`,
    pressed: isLiked,
  } as const;
}
