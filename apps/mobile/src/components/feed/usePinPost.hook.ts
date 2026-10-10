import { useMutation, useQueryClient } from "@tanstack/react-query";

import { profileQueryKeys } from "@/components/profile/profileQueries.hook";
import { ApiError } from "@/errors/api.error";
import { postsService } from "@/services/content/posts.service";
import { showAlertWithButtons } from "@/utils/crossPlatformAlert.util";

export interface PinnablePost {
  readonly id: string;
  readonly author: { readonly id: string };
  readonly isPinned?: boolean;
}

export function usePinPostMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (post: PinnablePost) => (post.isPinned === true ? postsService.unpinPost(post.id) : postsService.pinPost(post.id)),
    onSuccess: (updated, post) => {
      queryClient.setQueryData(["post", post.id], updated);
      void queryClient.invalidateQueries({ queryKey: profileQueryKeys.userPosts(post.author.id) });
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === "PIN_LIMIT_REACHED") {
        showAlertWithButtons("Pin limit reached", "You can pin up to 3 posts on your profile. Unpin one to pin another.");
        return;
      }
      showAlertWithButtons("Couldn't update pin", "Please check your connection and try again.");
    },
  });
}
