import { QueryHandler } from "@zudojs/cqrs";

import type { OrdersService } from "../../../orders/services/orders.service.js";
import type { EscrowRecord, EscrowTimelineEvent } from "../../models/escrows.model.js";
import type { DisputesRepository } from "../../repositories/escrows.repository.js";
import { buildEscrowTimeline } from "../../services/escrowTimeline.service.js";
import type { EscrowsService } from "../../services/escrows.service.js";
import type { GetEscrowQuery } from "./getEscrow.query.js";

export interface EscrowWithTimeline {
  readonly escrow: EscrowRecord;
  readonly timeline: readonly EscrowTimelineEvent[];
}

export class GetEscrowHandler extends QueryHandler<GetEscrowQuery, EscrowWithTimeline> {
  public readonly queryType = "escrows.getEscrow" as const;

  public constructor(private readonly ordersService: OrdersService, private readonly escrowsService: EscrowsService, private readonly disputes: DisputesRepository) {
    super();
  }

  public async execute(query: GetEscrowQuery): Promise<EscrowWithTimeline> {
    const order = await this.ordersService.findOrderForBuyerOrStoreMember(query.principal.userId, query.orderId);
    const escrow = await this.escrowsService.findEscrowForOrder(order.id);
    return { escrow, timeline: buildEscrowTimeline(escrow, order, await this.disputes.listForEscrow(escrow.id)) };
  }
}
