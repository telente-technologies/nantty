import { StyleSheet, View } from "react-native";

import { LikeActionIcon, ReplyActionIcon, RepostActionIcon, ShareActionIcon } from "@/components/icons";
import type { Post } from "@/types";

import { PostActionButton } from "./postActionButton";

export interface MediaLightboxPostActionsProps {
  readonly post: Post;
  readonly onToggleLike: () => void;
  readonly onPressComments: () => void;
  readonly onRepost: () => void;
  readonly onShare: () => void;
}

export function MediaLightboxPostActions({ post, onToggleLike, onPressComments, onRepost, onShare }: MediaLightboxPostActionsProps) {
  return (
    <View style={styles.row}>
      <PostActionButton
        label={post.liked ? "Unlike" : "Like"}
        tone="like"
        count={post.likes}
        active={post.liked}
        popOnActivate
        onPress={onToggleLike}
        defaultInk="#FFFFFF"
        renderIcon={(ink) => <LikeActionIcon size={21} color={ink} filled={post.liked} />}
      />
      <PostActionButton
        label="Reply"
        tone="reply"
        count={post.comments}
        onPress={onPressComments}
        defaultInk="#FFFFFF"
        renderIcon={(ink) => <ReplyActionIcon size={21} color={ink} />}
      />
      <PostActionButton
        label="Repost"
        tone="repost"
        count={post.reposts}
        onPress={onRepost}
        defaultInk="#FFFFFF"
        renderIcon={(ink) => <RepostActionIcon size={21} color={ink} />}
      />
      <PostActionButton
        label="Share"
        tone="reply"
        onPress={onShare}
        defaultInk="#FFFFFF"
        renderIcon={(ink) => <ShareActionIcon size={21} color={ink} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 52,
    marginHorizontal: 16,
    paddingHorizontal: 8,
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(12,12,18,0.74)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
});
