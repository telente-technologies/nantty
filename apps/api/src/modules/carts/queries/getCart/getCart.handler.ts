import { QueryHandler } from "@zudojs/cqrs";

import type { PricedCart } from "../../services/carts.service.js";
import type { CartsService } from "../../services/carts.service.js";
import type { GetCartQuery } from "./getCart.query.js";

export class GetCartHandler extends QueryHandler<GetCartQuery, PricedCart> {
  public readonly queryType = "carts.getCart" as const;

  public constructor(private readonly service: CartsService) {
    super();
  }

  public execute(query: GetCartQuery): Promise<PricedCart> {
    return this.service.buildPricedCartForUser(query.principal.userId);
  }
}
