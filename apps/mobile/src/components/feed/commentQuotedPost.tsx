import { useNavigation, type NavigationProp } from "@react-navigation/native";

import type { MainStackParamList } from "@/navigation/navigation.types";
import type { Comment } from "@/types";

import { QuotedPostCard } from "./quotedPostCard";

export function CommentQuotedPost({ comment }: { readonly comment: Pick<Comment, "quotedPost" | "quotedPostUnavailable"> }) {
  const navigation = useNavigation<NavigationProp<MainStackParamList>>();
  const quoted = comment.quotedPost ?? null;
  if (!quoted && !comment.quotedPostUnavailable) return null;
  return <QuotedPostCard compact quoted={quoted} unavailable={!quoted} onPress={quoted ? () => navigation.navigate("PostDetail", { postId: quoted.id }) : undefined} />;
}
