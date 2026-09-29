import type { TipReceiptDto } from "../dtos/creators.dto.js";
import type { CreatorsService } from "./creators.service.js";
import type { LiveGiftsService } from "./liveGifts.service.js";

export type TipTargetType = "post" | "clip" | "live";

export interface TipRequest {
  readonly senderId: string;
  readonly targetType: TipTargetType;
  readonly targetId: string;
  readonly coins: number;
  readonly idempotencyKey: string;
}

export class TipsService {
  public constructor(private readonly creatorsService: CreatorsService, private readonly gifts: LiveGiftsService) {}

  public async sendTip(request: TipRequest): Promise<TipReceiptDto> {
    const target = await this.findTipTarget(request);
    const receipt = await this.gifts.payCreatorInCoinsAndRecordEarning({
      senderId: request.senderId,
      creatorId: target.creatorId,
      coins: request.coins,
      kind: "tip",
      earningKind: "tip",
      sourceType: target.sourceType,
      sourceId: request.targetId,
      reference: `tip:${request.targetType}:${request.targetId}:${request.senderId}:${request.idempotencyKey}`,
    });
    if (receipt.created) {
      await this.gifts.notifyCreatorOfGift(target.creatorId, request.senderId, `a tip of ${request.coins} coins`, { type: "tip", targetType: request.targetType, targetId: request.targetId });
    }
    return { tipId: receipt.transactionId, targetType: request.targetType, targetId: request.targetId, coins: request.coins, balance: receipt.coinBalance };
  }

  private async findTipTarget(request: TipRequest): Promise<{ readonly creatorId: string; readonly sourceType: "live" | "post" | "clip" }> {
    const { postsService } = this.creatorsService.dependencies;
    if (request.targetType === "live") {
      const session = await postsService.findActiveLiveSessionOrThrow(request.targetId, request.senderId);
      return { creatorId: session.hostId, sourceType: "live" };
    }
    const post = await postsService.findVisiblePostOrThrow(request.targetId, request.senderId);
    return { creatorId: post.authorId, sourceType: post.kind === "clip" ? "clip" : "post" };
  }
}
