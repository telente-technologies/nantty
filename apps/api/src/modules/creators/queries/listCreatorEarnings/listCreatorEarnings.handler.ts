import { QueryHandler } from "@zudojs/cqrs";

import type { Page } from "../../../../types/pagination.type.js";
import { Money } from "../../../../utils/money.util.js";
import { mapPageItems } from "../../../../utils/pagination.util.js";
import type { CreatorEarningDto } from "../../dtos/creators.dto.js";
import type { CreatorProgramServices } from "../../services/creatorProgramServices.service.js";
import type { ListCreatorEarningsQuery } from "./listCreatorEarnings.query.js";

export class ListCreatorEarningsHandler extends QueryHandler<ListCreatorEarningsQuery, Page<CreatorEarningDto>> {
  public readonly queryType = "creators.listCreatorEarnings" as const;

  public constructor(private readonly services: CreatorProgramServices) {
    super();
  }

  public async execute(query: ListCreatorEarningsQuery): Promise<Page<CreatorEarningDto>> {
    const page = await this.services.creators.dependencies.earnings.listEarnings(query.userId, query.page);
    return mapPageItems(page, (earning) => ({
      id: earning.id,
      kind: earning.kind,
      source: { type: earning.sourceType, id: earning.sourceId },
      amount: Money.of(earning.netAmount, earning.currency).toDto(),
      grossAmount: Money.of(earning.grossAmount, earning.currency).toDto(),
      orderId: earning.orderId,
      productId: earning.productId,
      createdAt: earning.createdAt.toISOString(),
    }));
  }
}
