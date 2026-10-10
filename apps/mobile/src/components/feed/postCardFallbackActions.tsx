import { useEffect, useState } from "react";

import { useShareToChat } from "@/components/chatSafety/shareToChat.hook";
import { PostProductsFlow } from "@/components/home/postProductsFlow";
import { usePostInteractions } from "@/hooks/usePostInteractions.hook";
import type { Post, ProductSummary } from "@/types";

import { ReshareSheet } from "./reshareSheet";

export interface PostCardFallbackRequest {
  readonly kind: "share" | "repost" | "products";
  readonly nonce: number;
}

export interface PostCardFallbackActionsProps {
  readonly post: Post;
  readonly request: PostCardFallbackRequest;
}

export function PostCardFallbackActions({ post, request }: PostCardFallbackActionsProps) {
  const { sharePost } = usePostInteractions();
  const { offerSendInChat, sendInChatElement } = useShareToChat();
  const [reshareTarget, setReshareTarget] = useState<Post | null>(null);
  const [products, setProducts] = useState<readonly ProductSummary[] | null>(null);

  useEffect(() => {
    if (request.kind === "share") offerSendInChat({ kind: "post", id: post.id }, () => void sharePost(post));
    else if (request.kind === "repost") setReshareTarget(post);
    else setProducts(post.products);
  }, [request.nonce]);

  return (
    <>
      {sendInChatElement}
      <ReshareSheet post={reshareTarget} onClose={() => setReshareTarget(null)} />
      <PostProductsFlow products={products} onClose={() => setProducts(null)} />
    </>
  );
}
