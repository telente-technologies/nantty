import { useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";

import { ActionSheet } from "@/components/ui/actionSheet";
import { replyPolicyOptions } from "@/constants/postAudienceCopy.constant";
import { postsService } from "@/services/posts.service";
import type { Page, Post, ReplyPolicy } from "@/types";

export interface ReplySettingsSheetProps {
  readonly post: Post | null;
  readonly onClose: () => void;
}

export function ReplySettingsSheet({ post, onClose }: ReplySettingsSheetProps) {
  const queryClient = useQueryClient();
  const applyEverywhere = (updated: Post) => {
    queryClient.setQueryData(["post", updated.id], updated);
    queryClient.setQueriesData<InfiniteData<Page<Post>>>({ queryKey: ["feed"] }, (cached) =>
      cached ? { ...cached, pages: cached.pages.map((page) => ({ ...page, data: page.data.map((item) => (item.id === updated.id ? { ...item, replyPolicy: updated.replyPolicy } : item)) })) } : cached,
    );
  };
  const update = useMutation({
    mutationFn: (replyPolicy: ReplyPolicy) => postsService.updateReplySettings(post?.id ?? "", replyPolicy),
    onSuccess: applyEverywhere,
  });
  const current = post?.replyPolicy ?? "everyone";
  return (
    <ActionSheet
      visible={post !== null}
      onClose={onClose}
      title="Who can reply?"
      subtitle="Choose who can reply to this post. You can always reply."
      options={replyPolicyOptions.map((option) => ({
        label: option.value === current ? `${option.label} (current)` : option.label,
        detail: option.detail,
        onPress: () => {
          if (option.value !== current) update.mutate(option.value);
          onClose();
        },
      }))}
    />
  );
}
