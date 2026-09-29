import { unprocessable } from "../../../errors/domain.error.js";
import { NotificationRequestedEvent } from "../../../events/notificationRequested.event.js";
import type { CoinSpendKind, CreatorCoinPaymentReceipt } from "../../../interfaces/creatorWallets.interface.js";
import { publishEvent } from "../../../loaders/events.loader.js";
import { findGiftDefinition, GIFT_CATALOG } from "../constants/giftCatalog.constant.js";
import type { GiftCatalogEntryDto, GiftReceiptDto } from "../dtos/creators.dto.js";
import { LiveGiftSentEvent } from "../events/liveGiftSent.event.js";
import type { CreatorEarningKind, CreatorEarningSource } from "../models/creators.model.js";
import type { CreatorsService } from "./creators.service.js";

export interface LiveGiftRequest {
  readonly senderId: string;
  readonly liveSessionId: string;
  readonly giftId: string;
  readonly quantity: number;
  readonly idempotencyKey: string;
}

export interface PostGiftRequest {
  readonly senderId: string;
  readonly postId: string;
  readonly giftId: string;
  readonly quantity: number;
  readonly idempotencyKey: string;
}

export interface CreatorCoinPaymentRequest {
  readonly senderId: string;
  readonly creatorId: string;
  readonly coins: number;
  readonly kind: CoinSpendKind;
  readonly earningKind: CreatorEarningKind;
  readonly sourceType: CreatorEarningSource;
  readonly sourceId: string;
  readonly reference: string;
}

export const COIN_UNIT = "COIN";

export function presentGiftCatalog(): GiftCatalogEntryDto[] {
  return GIFT_CATALOG.map((gift) => ({ id: gift.id, name: gift.name, emoji: gift.emoji, imageUrl: null, priceCoins: gift.priceCoins }));
}

export class LiveGiftsService {
  public constructor(private readonly creatorsService: CreatorsService) {}

  public findCreatorCoinShareBasisPoints(): number {
    return 10_000 - this.creatorsService.dependencies.settings.liveGiftPlatformCutBps;
  }

  public async payCreatorInCoinsAndRecordEarning(request: CreatorCoinPaymentRequest): Promise<CreatorCoinPaymentReceipt> {
    const { creatorWallets, earnings, clock } = this.creatorsService.dependencies;
    if (request.senderId === request.creatorId) throw unprocessable("You cannot send coins to yourself.");
    if (!(await this.creatorsService.access.isApprovedCreator(request.creatorId))) throw unprocessable("This creator cannot receive coins right now.");
    const receipt = await creatorWallets.payForLiveGift({
      reference: request.reference,
      kind: request.kind,
      senderUserId: request.senderId,
      recipientUserId: request.creatorId,
      coins: request.coins,
      creatorShareBasisPoints: this.findCreatorCoinShareBasisPoints(),
    });
    await earnings.recordEarningIfNew({
      creatorId: request.creatorId,
      kind: request.earningKind,
      reference: request.reference,
      sourceType: request.sourceType,
      sourceId: request.sourceId,
      grossAmount: request.coins,
      netAmount: receipt.creatorCoins,
      currency: COIN_UNIT,
      orderId: null,
      productId: null,
      createdAt: clock.now(),
    });
    return receipt;
  }

  public async sendLiveGift(request: LiveGiftRequest): Promise<GiftReceiptDto> {
    const { postsService, earnings, clock, events } = this.creatorsService.dependencies;
    const session = await postsService.findActiveLiveSessionOrThrow(request.liveSessionId, request.senderId);
    if (session.hostId === request.senderId) throw unprocessable("You cannot send a gift to your own live session.");
    const gift = findGiftDefinition(request.giftId);
    if (gift === undefined) throw unprocessable("This gift is not available.");
    const coins = gift.priceCoins * request.quantity;
    const reference = `live-gift:${session.id}:${request.senderId}:${request.idempotencyKey}`;
    const receipt = await this.payCreatorInCoinsAndRecordEarning({
      senderId: request.senderId, creatorId: session.hostId, coins, kind: "live_gift", earningKind: "gift", sourceType: "live", sourceId: session.id, reference,
    });
    const recorded = await earnings.recordLiveGiftIfNew({
      liveSessionId: session.id, senderId: request.senderId, creatorId: session.hostId, giftId: gift.id, quantity: request.quantity, amount: coins, currency: COIN_UNIT, reference, createdAt: clock.now(),
    });
    if (recorded.created) {
      await publishEvent(events, LiveGiftSentEvent, {
        liveSessionId: session.id, giftId: gift.id, quantity: request.quantity, senderId: request.senderId, creatorId: session.hostId, amountMinor: coins, currency: COIN_UNIT,
      });
      await this.notifyCreatorOfGift(session.hostId, request.senderId, `${request.quantity} × ${gift.emoji} ${gift.name}`, { type: "live_gift", liveSessionId: session.id, giftId: gift.id });
    }
    const stored = recorded.gift;
    return {
      id: stored.id, liveSessionId: stored.liveSessionId, postId: null, giftId: stored.giftId, quantity: stored.quantity, coins: stored.amount, coinBalance: receipt.coinBalance, createdAt: stored.createdAt.toISOString(),
    };
  }

  public async sendPostGift(request: PostGiftRequest): Promise<GiftReceiptDto> {
    const { postsService } = this.creatorsService.dependencies;
    const post = await postsService.findVisiblePostOrThrow(request.postId, request.senderId);
    if (post.authorId === request.senderId) throw unprocessable("You cannot send a gift to your own post.");
    const gift = findGiftDefinition(request.giftId);
    if (gift === undefined) throw unprocessable("This gift is not available.");
    const coins = gift.priceCoins * request.quantity;
    const receipt = await this.payCreatorInCoinsAndRecordEarning({
      senderId: request.senderId,
      creatorId: post.authorId,
      coins,
      kind: "post_gift",
      earningKind: "gift",
      sourceType: post.kind === "clip" ? "clip" : "post",
      sourceId: post.id,
      reference: `post-gift:${post.id}:${request.senderId}:${request.idempotencyKey}`,
    });
    if (receipt.created) await this.notifyCreatorOfGift(post.authorId, request.senderId, `${request.quantity} × ${gift.emoji} ${gift.name}`, { type: "post_gift", postId: post.id, giftId: gift.id });
    return {
      id: receipt.transactionId, liveSessionId: null, postId: post.id, giftId: gift.id, quantity: request.quantity, coins, coinBalance: receipt.coinBalance, createdAt: this.creatorsService.dependencies.clock.now().toISOString(),
    };
  }

  public async notifyCreatorOfGift(creatorId: string, senderId: string, what: string, data: Readonly<Record<string, string>>): Promise<void> {
    const { postsService, events } = this.creatorsService.dependencies;
    const sender = await postsService.findActorUsername(senderId);
    await publishEvent(events, NotificationRequestedEvent, { userId: creatorId, category: "live", title: "New gift", body: `${sender} sent you ${what}.`, data });
  }
}
