import type { DecidedAd, SponsoredPlacementView } from "../../../interfaces/adDecisions.interface.js";
import type { HandlerContext } from "../../../types/handlerContext.type.js";
import type { MediaView, PostView } from "../../posts/models/post.model.js";
import { buildPostViews } from "../../posts/services/postView.service.js";
import { postRepository } from "../../posts/repositories/post.repository.js";

const organicPostsBeforeFirstAd = 3;
const minimumOrganicPostsForAd = 4;

function placementLabel(label: string): SponsoredPlacementView["label"] {
  if (label === "Promoted" || label === "Boosted") return label;
  return "Sponsored";
}

export function toSponsoredPlacement(ad: DecidedAd): SponsoredPlacementView {
  const creative = ad.creative;
  return {
    campaignId: ad.adId, label: placementLabel(ad.label), advertiserName: creative.identity.name,
    ...(creative.callToAction === "" ? {} : { ctaLabel: creative.callToAction }),
    ...(creative.destination.url === null ? {} : { ctaUrl: creative.destination.url }),
    adType: creative.type, impressionToken: ad.impressionToken, destination: creative.destination, mediaClickable: creative.mediaClickable,
    ...(ad.clickLinks === null ? {} : { clickLinks: ad.clickLinks }),
    ...(creative.cards === undefined ? {} : { cards: creative.cards }),
    ...(creative.app === undefined ? {} : { app: creative.app }),
  };
}

export function buildSponsoredPostView(ad: DecidedAd, now: Date): PostView {
  const creative = ad.creative;
  const media: MediaView[] = creative.media.map((item) => ({
    id: item.id, type: item.kind === "video" ? "video" : "image", url: item.url, posterUrl: item.posterUrl, hlsUrl: null, width: item.width, height: item.height,
    ...(item.durationSeconds === null ? {} : { durationSeconds: item.durationSeconds }), blurhash: null, status: "ready",
  }));
  return {
    id: `ad-${ad.adId}`, kind: "post", author: { id: creative.source.id, name: creative.identity.name, username: creative.identity.handle, avatarUrl: creative.identity.avatarUrl, verified: creative.identity.verifiedBusiness, isCreator: false }, postedAs: null,
    createdAt: now.toISOString(), text: creative.primaryText, media, likes: 0, comments: 0, reposts: 0, reposted: false, views: 0, liked: false, bookmarked: false, isSaved: false, saveCount: 0,
    isFollowingAuthor: false, shares: 0, durationSeconds: null, friendsLiked: null, products: [], sponsored: toSponsoredPlacement(ad), topics: [], location: null, slideshow: null,
    subscriberOnly: false, viewerHasAccess: true, resharedFrom: null, resharedFromUnavailable: false, isQuote: false, quotes: 0, replyPolicy: "off", viewerCanReply: false,
    viewerCanDownload: false, replyRestriction: null, sensitive: null, isAiGenerated: false, isPinned: false, pinnedAt: null, pinnedCommentId: null, viewerNotificationsMuted: false, mentions: [], linkPreview: null, taggedUsers: [], taggedUsersCount: 0, look: null,
  };
}

async function viewForAd(context: HandlerContext, viewerId: string, ad: DecidedAd, now: Date): Promise<PostView | null> {
  if (ad.creative.source.type !== "post" || ad.creative.source.id === "") return buildSponsoredPostView(ad, now);
  const row = await postRepository.findById(context.database.client, ad.creative.source.id);
  if (row === null) return null;
  const [view] = await buildPostViews(context, viewerId, [row]);
  return view === undefined ? null : { ...view, sponsored: toSponsoredPlacement(ad) };
}

export async function insertSponsoredPost(context: HandlerContext, request: { readonly viewerId: string | undefined; readonly views: readonly PostView[]; readonly surface: "feed" | "clips"; readonly pageIndex: number; readonly country: string | null; readonly topics: readonly string[] }): Promise<PostView[]> {
  const views = [...request.views];
  if (request.viewerId === undefined || context.ads === undefined || views.length < minimumOrganicPostsForAd) return views;
  const now = context.clock.now();
  const premiumAdFree = await context.premium.isPremium(request.viewerId).catch(() => false);
  if (premiumAdFree) return views;
  const ad = await context.ads.decide({
    userId: request.viewerId, sessionId: `${request.surface}:${request.viewerId}:${now.toISOString().slice(0, 10)}`, slotKind: request.surface === "clips" ? "clipBetween" : "feedPost",
    neighbourContentIds: views.slice(organicPostsBeforeFirstAd - 1, organicPostsBeforeFirstAd + 1).map((view) => view.id), slotsSinceLastAd: request.pageIndex === 0 ? organicPostsBeforeFirstAd : views.length,
    slotIndex: request.pageIndex * (views.length + 1) + organicPostsBeforeFirstAd, viewer: { country: request.country, topics: request.topics, premiumAdFree },
  });
  if (ad === null) return views;
  const sponsored = await viewForAd(context, request.viewerId, ad, now).catch(() => null);
  if (sponsored === null || views.some((view) => view.id === sponsored.id)) return views;
  views.splice(organicPostsBeforeFirstAd, 0, sponsored);
  return views;
}
