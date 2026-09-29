import type { ValidationIssue } from "../../../errors/ads.error.js";
import type { MediaLibraryItem } from "../../../interfaces/mediaLibrary.interface.js";
import { Money } from "../../../utils/money.util.js";
import type { LiveSessionRecord, PostMedia, PostRecord } from "../../posts/models/posts.model.js";
import type { AdAccountRecord } from "../models/adAccounts.model.js";
import type { CreativeInput, CreativeMedia, CreativeProduct, ResolvedCreative } from "../models/adCampaigns.model.js";
import type { AdsDependencies } from "../models/adsDependencies.model.js";

export interface ResolvedCreativeResult {
  readonly creative: ResolvedCreative;
  readonly issues: readonly ValidationIssue[];
}

export class AdCreativesService {
  public constructor(private readonly dependencies: AdsDependencies) {}

  public async resolveCreative(account: AdAccountRecord, input: CreativeInput, path: string): Promise<ResolvedCreativeResult> {
    const issues: ValidationIssue[] = [];
    const sourceIssue = { path: `${path}.source`, message: "Choose an eligible post, reel, product, live session or store from this account." };
    let media: CreativeMedia[] = [];
    let product: CreativeProduct | null = null;
    let live: ResolvedCreative["live"] = null;
    let topics: readonly string[] = [];
    const { type, id } = input.source;
    if (type === "post" || type === "clip") {
      const post = await this.dependencies.posts.findById(id);
      if (post === undefined || !this.ownsPost(account, post) || post.deletedAt !== null || post.kind !== type) issues.push(sourceIssue);
      else {
        media = await this.describePostMedia(post.media);
        topics = post.topics;
        product = post.productIds[0] === undefined ? null : await this.describeProduct(post.productIds[0], account);
      }
    } else if (type === "product") {
      product = await this.describeProduct(id, account);
      if (product === null) issues.push(sourceIssue);
      else {
        const [summary] = await this.dependencies.productCatalog.findProductSummaries([id]);
        if (summary?.imageUrl !== null && summary?.imageUrl !== undefined) media = [{ id, kind: "image", url: summary.imageUrl, posterUrl: null, width: 1080, height: 1080, durationSeconds: null }];
      }
    } else if (type === "live") {
      const session = await this.dependencies.liveSessions.findById(id);
      if (session === undefined || !this.ownsLiveSession(account, session) || session.status !== "live") issues.push(sourceIssue);
      else live = { liveSessionId: session.id, status: "live", startsAt: session.startedAt.toISOString(), viewerCount: session.viewerCount };
    } else if (type === "store") {
      if (account.storeId === null || account.storeId !== id) issues.push(sourceIssue);
    }
    if (input.mediaIds.length > 0 || type === "upload") {
      const uploaded = await this.describeUploadedMedia(account, input.mediaIds);
      if (uploaded === undefined || (type === "upload" && uploaded.length === 0)) issues.push({ path: `${path}.mediaIds`, message: "Upload at least one image or video." });
      else if (uploaded.length > 0) media = uploaded;
    }
    const identity = await this.describeIdentity(account);
    return {
      creative: { format: input.format, source: input.source, media, headline: input.headline, primaryText: input.primaryText, callToAction: input.callToAction, destination: input.destination, identity, product, live, topics },
      issues,
    };
  }

  public ownsPost(account: AdAccountRecord, post: PostRecord): boolean {
    return account.storeId === null ? post.authorId === account.ownerId && post.storeId === null : post.storeId === account.storeId || post.authorId === account.ownerId;
  }

  public ownsLiveSession(account: AdAccountRecord, session: LiveSessionRecord): boolean {
    return session.hostId === account.ownerId || (account.storeId !== null && session.storeId === account.storeId);
  }

  public async describeProduct(productId: string, account: AdAccountRecord): Promise<CreativeProduct | null> {
    const [summary] = await this.dependencies.productCatalog.findProductSummaries([productId]);
    if (summary === undefined || !summary.published || account.storeId === null || summary.storeId !== account.storeId) return null;
    return {
      productId: summary.id,
      title: summary.title,
      price: Money.of(summary.price, summary.currency).toDto(),
      compareAtPrice: summary.compareAtPrice === null ? null : Money.of(summary.compareAtPrice, summary.currency).toDto(),
      rating: summary.ratingCount > 0 ? summary.ratingAverage : null,
    };
  }

  public async describePostMedia(postMedia: readonly PostMedia[]): Promise<CreativeMedia[]> {
    const libraryIds = postMedia.flatMap((item) => (item.mediaId === undefined ? [] : [item.mediaId]));
    const library = new Map((libraryIds.length === 0 ? [] : await this.dependencies.mediaLibrary.findMediaByIds(libraryIds)).map((item) => [item.id, item]));
    return postMedia.map((item, index) => {
      const stored = item.mediaId === undefined ? undefined : library.get(item.mediaId);
      return {
        id: item.mediaId ?? `media-${index}`,
        kind: item.type,
        url: item.url,
        posterUrl: item.posterUrl ?? stored?.posterUrl ?? null,
        width: item.width ?? stored?.width ?? 1080,
        height: item.height ?? stored?.height ?? (item.type === "video" ? 1920 : 1080),
        durationSeconds: stored?.durationSeconds ?? null,
      };
    });
  }

  private async describeUploadedMedia(account: AdAccountRecord, mediaIds: readonly string[]): Promise<CreativeMedia[] | undefined> {
    if (mediaIds.length === 0) return [];
    const items = await this.dependencies.mediaLibrary.findMediaByIds(mediaIds);
    const members = new Set((await this.dependencies.accounts.listMembers(account.id)).map((member) => member.userId));
    const usable = (item: MediaLibraryItem) => members.has(item.ownerId) && item.status !== "failed" && (item.type === "image" || item.type === "video");
    if (items.length !== mediaIds.length || !items.every(usable)) return undefined;
    return items.map((item) => ({
      id: item.id,
      kind: item.type === "video" ? "video" : "image",
      url: item.url ?? "",
      posterUrl: item.posterUrl,
      width: item.width ?? 0,
      height: item.height ?? 0,
      durationSeconds: item.durationSeconds,
    }));
  }

  private async describeIdentity(account: AdAccountRecord): Promise<ResolvedCreative["identity"]> {
    if (account.storeId !== null) {
      const [store] = await this.dependencies.storeAccess.findStoreSummaries([account.storeId]);
      const badge = (await this.dependencies.verificationBadges.findVerificationBadges([account.storeId])).get(account.storeId);
      return { name: store?.name ?? account.name, handle: store?.slug ?? "", avatarUrl: store?.logoUrl ?? null, verifiedBusiness: badge?.color === "GOLD" && badge.status === "VERIFIED" };
    }
    const [owner] = await this.dependencies.userDirectory.findUserSummaries([account.ownerId]);
    return { name: owner?.name ?? account.name, handle: owner?.username ?? "", avatarUrl: owner?.avatarUrl ?? null, verifiedBusiness: false };
  }
}
