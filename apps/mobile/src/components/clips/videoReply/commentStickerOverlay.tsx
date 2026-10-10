import { useNavigation, type NavigationProp } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import type { MainStackParamList } from "@/navigation/navigation.types";
import { postCommentsService } from "@/services/content/postComments.service";
import { ApiError } from "@/errors/api.error";
import type { Post } from "@/types";

import { CommentStickerBubble } from "./commentStickerBubble";
import { StickerPlacement } from "./stickerPlacement";

const useVideoReplyComment = (commentId: string | undefined) =>
  useQuery({
    queryKey: ["comment", commentId],
    enabled: !!commentId,
    retry: false,
    queryFn: async () => {
      try {
        return await postCommentsService.fetchComment(commentId!);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    },
  });

export function CommentStickerOverlay({ clip }: { readonly clip: Pick<Post, "replyToComment" | "stickerLayout"> }) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const reply = clip.replyToComment;
  const comment = useVideoReplyComment(reply?.commentId);
  const layout = clip.stickerLayout;
  if (!reply || !layout || layout.hidden || comment.isLoading) return null;
  const data = comment.data;
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={(event) => setSize({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })}
    >
      {size.width > 0 ? (
        <StickerPlacement layout={layout} stageWidth={size.width} stageHeight={size.height}>
          <CommentStickerBubble username={data?.author.username ?? ""} avatarUrl={data?.author.avatarUrl ?? null} text={data?.text ?? ""} isDeleted={!data} />
        </StickerPlacement>
      ) : null}
    </View>
  );
}

export interface ReplyingToCommentLinkProps {
  readonly clip: Pick<Post, "replyToComment">;
  readonly foregroundColor?: string;
}

export function ReplyingToCommentLink({ clip, foregroundColor }: ReplyingToCommentLinkProps) {
  const navigation = useNavigation<NavigationProp<MainStackParamList>>();
  const reply = clip.replyToComment;
  const comment = useVideoReplyComment(reply?.commentId);
  if (!reply) return null;
  const username = comment.data?.author.username;
  const label = comment.data === null ? "Replying to a deleted comment" : username ? `Replying to @${username}'s comment` : "Replying to a comment";
  return (
    <Text
      size={12}
      weight={600}
      lineHeight={16.8}
      color={foregroundColor}
      accessibilityRole="link"
      accessibilityHint="Opens the original clip and the comment"
      onPress={() => navigation.navigate("Tabs", { screen: "Clips", params: { startId: reply.clipId, commentId: reply.commentId } })}
    >
      {label}
    </Text>
  );
}
