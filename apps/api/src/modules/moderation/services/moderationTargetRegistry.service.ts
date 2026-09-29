import { notFound, unprocessable } from "../../../errors/domain.error.js";
import type { ModerationTargetGateway, ModerationTargetType } from "../../../interfaces/moderationTargets.interface.js";

export class ModerationTargetRegistry {
  private readonly gateways = new Map<ModerationTargetType, ModerationTargetGateway>();

  public register(gateway: ModerationTargetGateway): void {
    this.gateways.set(gateway.targetType, gateway);
  }

  public requireGateway(targetType: ModerationTargetType): ModerationTargetGateway {
    const gateway = this.gateways.get(targetType);
    if (gateway === undefined) throw unprocessable(`${targetType} reports are not supported yet.`);
    return gateway;
  }

  public async describeTargetOrThrow(targetType: ModerationTargetType, targetId: string) {
    const description = await this.requireGateway(targetType).describeTarget(targetId);
    if (description === undefined) throw notFound("Reported content");
    return description;
  }
}
