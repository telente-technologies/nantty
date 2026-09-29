import type { CurrencyCode } from "../../../enums/currency.enum.js";
import { unprocessable } from "../../../errors/domain.error.js";
import { NotificationRequestedEvent } from "../../../events/notificationRequested.event.js";
import { publishEvent } from "../../../loaders/events.loader.js";
import { Money } from "../../../utils/money.util.js";
import { findGiftDefinition, GIFT_CATALOG } from "../constants/giftCatalog.constant.js";
import type { GiftCatalogEntryDto, LiveGiftReceiptDto } from "../dtos/creators.dto.js";
import { LiveGiftSentEvent } from "../events/liveGiftSent.event.js";
import type { CreatorsService } from "./creators.service.js";

export interface LiveGiftRequest {
  readonly senderId: string;
  readonly liveSessionId: string;
  readonly giftId: string;
  readonly quantity: number;
  readonly idempotencyKey: string;
  readonly currency: CurrencyCode;
}

export function presentGiftCatalog(displayCurrency: CurrencyCode): GiftCatalogEntryDto[] {
  return GIFT_CATALOG.map((gift) => ({
    id: gift.id,
    name: gift.name,
    emoji: gift.emoji,
    price: Money.of(gift.pricesInMinorUnits[displayCurrency], displayCurrency).toDto(),
    prices: Object.entries(gift.pricesInMinorUnits).map(([currency, amountMinor]) => Money.of(amountMinor, currency).toDto()),
  }));
}

export class LiveGiftsService {
  public constructor(private readonly creatorsService: CreatorsService) {}

  public async sendLiveGift(request: LiveGiftRequest): Promise<LiveGiftReceiptDto> {
    const { postsService, creatorWallets, earnings, settings, clock, events } = this.creatorsService.dependencies;
    const session = await postsService.findActiveLiveSessionOrThrow(request.liveSessionId, request.senderId);
    if (session.hostId === request.senderId) throw unprocessable("You cannot send a gift to your own live session.");
    if (!(await this.creatorsService.access.isApprovedCreator(session.hostId))) throw unprocessable("This host cannot receive gifts right now.");
    const gift = findGiftDefinition(request.giftId);
    if (gift === undefined) throw unprocessable("This gift is not available.");
    const amount = Money.of(gift.pricesInMinorUnits[request.currency], request.currency).multiplyByQuantity(request.quantity);
    const creatorShare = amount.subtract(amount.calculateBasisPointsShareRoundingDown(settings.liveGiftPlatformCutBps));
    const reference = `live-gift:${session.id}:${request.senderId}:${request.idempotencyKey}`;
    await creatorWallets.payForLiveGift({
      reference,
      senderUserId: request.senderId,
      recipientUserId: session.hostId,
      amount,
      platformCutBasisPoints: settings.liveGiftPlatformCutBps,
    });
    const createdAt = clock.now();
    const recorded = await earnings.recordLiveGiftIfNew({
      liveSessionId: session.id,
      senderId: request.senderId,
      creatorId: session.hostId,
      giftId: gift.id,
      quantity: request.quantity,
      amount: amount.amountMinor,
      currency: amount.currency,
      reference,
      createdAt,
    });
    await earnings.recordEarningIfNew({
      creatorId: session.hostId,
      kind: "gift",
      reference,
      sourceType: "live",
      sourceId: session.id,
      grossAmount: amount.amountMinor,
      netAmount: creatorShare.amountMinor,
      currency: amount.currency,
      orderId: null,
      productId: null,
      createdAt,
    });
    if (recorded.created) {
      await publishEvent(events, LiveGiftSentEvent, {
        liveSessionId: session.id,
        giftId: gift.id,
        quantity: request.quantity,
        senderId: request.senderId,
        creatorId: session.hostId,
        amountMinor: amount.amountMinor,
        currency: amount.currency,
      });
      const sender = await postsService.findActorUsername(request.senderId);
      await publishEvent(events, NotificationRequestedEvent, {
        userId: session.hostId,
        category: "live",
        title: "New gift",
        body: `${sender} sent you ${request.quantity} × ${gift.emoji} ${gift.name}.`,
        data: { type: "live_gift", liveSessionId: session.id, giftId: gift.id },
      });
    }
    const stored = recorded.gift;
    return {
      id: stored.id,
      liveSessionId: stored.liveSessionId,
      giftId: stored.giftId,
      quantity: stored.quantity,
      amount: Money.of(stored.amount, stored.currency).toDto(),
      createdAt: stored.createdAt.toISOString(),
    };
  }
}
