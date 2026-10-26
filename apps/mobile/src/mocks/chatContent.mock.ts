import { ApiError } from "@/errors/api.error";
import type { Post, SendToChatsInput, SharedContentCard, SharedContentReference } from "@/types";
import { formatMoneyForDisplay } from "@/utils/formatMoney.util";

import { appendMockMessageAndUpdateConversation, findMockConversation } from "./chats.mock";
import { lookupLinkPreview } from "./chatLinkPreviewLookup.mock";
import { findMockClipsByIds } from "./clips.mock";
import { getSignedInMockUser } from "./fixtures.mock";
import { buildLiveSession } from "./live.mock";
import { buildCatalogProductDetail } from "./productCatalog.mock";
import { findPostIncludingSponsored } from "./posts.mock";
import { mockPostsState } from "./postCatalog.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";
import { canSignedInUserSeeProfileContent, followStateForUser, isFollowingUser } from "./socialGraph.mock";
import { directoryStores, findDirectoryStoreById, storeBannerUrl } from "./storeDirectory.mock";
import { findDirectoryUserById } from "./userDirectory.mock";

const shareCountByReferenceKey = new Map<string, number>();

const referenceKey = (reference: SharedContentReference) => `${reference.kind}:${reference.id}`;

const unavailableCard = (reference: SharedContentReference, availability: "private" | "unavailable"): SharedContentCard => ({
  reference,
  availability,
  title: availability === "private" ? "This post is private" : "No longer available",
  subtitle: null,
  imageUrl: null,
});

const buildPostCard = (reference: SharedContentReference, post: Post | undefined): SharedContentCard => {
  if (post) return { reference, availability: "available", title: post.text.slice(0, 90) || "Post", subtitle: `@${post.author.username}`, imageUrl: post.media[0]?.url ?? null };
  return unavailableCard(reference, mockPostsState.has(reference.id) ? "private" : "unavailable");
};

export const resolveSharedContentCard = (reference: SharedContentReference): SharedContentCard => {
  switch (reference.kind) {
    case "order":
      return reference.id.startsWith("gone")
        ? unavailableCard(reference, "unavailable")
        : { reference, availability: "available", title: "Order ZM-1042", subtitle: "3 items · shipped", imageUrl: null, priceLabel: "₦54,000" };
    case "product": {
      const product = buildCatalogProductDetail(reference.id);
      if (!product) return unavailableCard(reference, "unavailable");
      return { reference, availability: "available", title: product.name, subtitle: product.store.name, imageUrl: product.images[0] ?? null, priceLabel: formatMoneyForDisplay(product.price, { showDecimals: false }), stock: product.stock ?? null };
    }
    case "profile": {
      const user = findDirectoryUserById(reference.id);
      if (!user || followStateForUser(user.id) === "blocked") return unavailableCard(reference, "unavailable");
      return {
        reference,
        availability: "available",
        title: user.name,
        subtitle: `@${user.username}${canSignedInUserSeeProfileContent(user.id) ? "" : " · Private account"}`,
        imageUrl: user.avatarUrl,
        followsAuthor: isFollowingUser(user.id),
        profileUserId: user.id,
      };
    }
    case "live": {
      const session = buildLiveSession(reference.id);
      if (session.status === "ended") return unavailableCard(reference, "unavailable");
      return { reference, availability: "available", title: session.title, subtitle: session.host.name, imageUrl: session.host.avatarUrl, isLive: true, viewerCount: session.viewers };
    }
    case "store": {
      const store = directoryStores.find((candidate) => candidate.id === reference.id);
      return store ? { reference, availability: "available", title: store.name, subtitle: store.city, imageUrl: storeBannerUrl(findDirectoryStoreById(store.id)) } : unavailableCard(reference, "unavailable");
    }
    case "clip":
      return buildPostCard(reference, findMockClipsByIds([reference.id])[0] ?? findPostIncludingSponsored(reference.id));
    default:
      return buildPostCard(reference, findPostIncludingSponsored(reference.id));
  }
};

export const chatContentMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/link-previews/resolve", ({ query }) => lookupLinkPreview(query.get("url") ?? "")),
  createMockRoute("GET", "/api/v1/chat/content", ({ query }) => resolveSharedContentCard({ kind: query.get("kind") as SharedContentReference["kind"], id: query.get("id") ?? "" })),
  createMockRoute("POST", "/api/v1/chat/shares", ({ body }) => {
    const input = body as SendToChatsInput & { readonly note?: string };
    if (input.note) throw new ApiError(400, "Notes travel encrypted, never as plain text.", "VALIDATION_FAILED");
    if (input.conversationIds.length === 0) throw new ApiError(400, "Pick at least one chat");
    if (input.conversationIds.some((conversationId) => !input.encryptions?.some((entry) => entry.conversationId === conversationId))) {
      throw new ApiError(422, "Shared items are end-to-end encrypted. Update Nantty to share to chats.", "ENCRYPTION_REQUIRED");
    }
    const card = resolveSharedContentCard(input.reference);
    if (card.availability !== "available") throw new ApiError(409, card.title);
    input.conversationIds.forEach((conversationId, index) => {
      const conversation = findMockConversation(conversationId);
      const sealed = input.encryptions?.find((entry) => entry.conversationId === conversationId);
      appendMockMessageAndUpdateConversation({
        id: `m_share_${Date.now()}_${index}`,
        conversationId: conversation.id,
        senderId: getSignedInMockUser().id,
        text: "",
        createdAt: new Date().toISOString(),
        kind: "shared",
        encryption: sealed ? { deviceId: sealed.deviceId, ciphertext: sealed.ciphertext, protocol: "signal-v1" } : null,
      });
    });
    const shareCount = (shareCountByReferenceKey.get(referenceKey(input.reference)) ?? 0) + input.conversationIds.length;
    shareCountByReferenceKey.set(referenceKey(input.reference), shareCount);
    return { sentCount: input.conversationIds.length, shareCount };
  }),
];
