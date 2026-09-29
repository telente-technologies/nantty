import { QueryHandler } from "@zudojs/cqrs";

import type { OrdersService } from "../../../orders/services/orders.service.js";
import type { EscrowRecord } from "../../models/escrows.model.js";
import type { EscrowsService } from "../../services/escrows.service.js";
import type { GetEscrowQuery } from "./getEscrow.query.js";

export class GetEscrowHandler extends QueryHandler<GetEscrowQuery, EscrowRecord> {
  public readonly queryType = "escrows.getEscrow" as const;

  public constructor(private readonly ordersService: OrdersService, private readonly escrowsService: EscrowsService) {
    super();
  }

  public async execute(query: GetEscrowQuery): Promise<EscrowRecord> {
    const order = await this.ordersService.findOrderForBuyerOrStoreMember(query.principal.userId, query.orderId);
    return this.escrowsService.findEscrowForOrder(order.id);
  }
}
