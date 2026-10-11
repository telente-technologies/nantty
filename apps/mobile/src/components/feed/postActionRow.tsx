import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { BookmarkActionIcon, LikeActionIcon, ReplyActionIcon, RepostActionIcon, ShareActionIcon, ViewsActionIcon } from "@/components/icons";
import { useSaveToggle } from "@/hooks/useSaveToggle.hook";
import { saveTargetForPost, type Post } from "@/types";

import { PostActionButton } from "./postActionButton";
import { ViewsExplainerSheet } from "./viewsExplainerSheet";

const ICON_SIZE = 19;
export { VIEWS_HELP_TOPIC_SLUG } from "./viewsExplainerSheet";

export interface PostActionRowProps {
  readonly post: Post;
  readonly isOwnPost: boolean;
  readonly onToggleLike?: () => void;
  readonly onPressComments?: () => void;
  readonly onRepost?: () => void;
  readonly onShare?: () => void;
  readonly onPressAnalytics?: () => void;
  readonly likePopKey?: number;
}

export function PostActionRow({ post, isOwnPost, onToggleLike, onPressComments, onRepost, onShare, onPressAnalytics, likePopKey }: PostActionRowProps) {
  const [viewsInfoOpen, setViewsInfoOpen] = useState(false);
  const { isSaved, savedDelta, toggleSaved } = useSaveToggle(saveTargetForPost(post), post.bookmarked);
  return (
    <View style={styles.row}>
      <PostActionButton
        label={post.liked ? "Unlike" : "Like"}
        tone="like"
        count={post.likes}
        active={post.liked}
        popOnActivate
        popKey={likePopKey}
        onPress={onToggleLike}
        renderIcon={(ink) => <LikeActionIcon size={ICON_SIZE} color={ink} filled={post.liked} />}
      />
      <PostActionButton label="Reply" tone="reply" count={post.comments} onPress={onPressComments} renderIcon={(ink) => <ReplyActionIcon size={ICON_SIZE} color={ink} />} />
      <PostActionButton label="Repost" tone="repost" count={post.reposts} onPress={onRepost} renderIcon={(ink) => <RepostActionIcon size={ICON_SIZE} color={ink} />} />
      <PostActionButton
        label={isOwnPost ? "Views, open post analytics" : "Views, what are views"}
        tone="reply"
        count={post.views}
        onPress={isOwnPost ? onPressAnalytics : () => setViewsInfoOpen(true)}
        renderIcon={(ink) => <ViewsActionIcon size={ICON_SIZE} color={ink} />}
      />
      <PostActionButton
        label={isSaved ? "Remove post from saved" : "Save post"}
        tone="bookmark"
        count={Math.max((post.saveCount ?? 0) + savedDelta, 0)}
        active={isSaved}
        popOnActivate
        onPress={() => void toggleSaved()}
        renderIcon={(ink) => <BookmarkActionIcon size={ICON_SIZE} color={ink} filled={isSaved} />}
      />
      <PostActionButton label="Share" tone="reply" onPress={onShare} renderIcon={(ink) => <ShareActionIcon size={ICON_SIZE} color={ink} />} />
      <ViewsExplainerSheet visible={viewsInfoOpen} onClose={() => setViewsInfoOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
});
