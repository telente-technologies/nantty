import type { QueryClient } from "@tanstack/react-query";

import type { QueuedOfflineMutation } from "./offlineMutation.type";

export function invalidateQueriesAffectedByReplayedOfflineMutation(queryClient: QueryClient, mutation: QueuedOfflineMutation) {
  switch (mutation.kind) {
    case "likePost":
    case "unlikePost":
      queryClient.invalidateQueries({ queryKey: ["post", mutation.payload.postId] });
      return;
    case "followUser":
    case "unfollowUser":
      queryClient.invalidateQueries({ queryKey: ["users", mutation.payload.userId] });
      return;
    case "sendMessage":
      queryClient.invalidateQueries({ queryKey: ["messages", mutation.payload.conversationId] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
  }
}
