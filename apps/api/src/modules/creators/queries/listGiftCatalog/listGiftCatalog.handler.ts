import { QueryHandler } from "@zudojs/cqrs";

import type { GiftCatalogEntryDto } from "../../dtos/creators.dto.js";
import { presentGiftCatalog } from "../../services/liveGifts.service.js";
import type { ListGiftCatalogQuery } from "./listGiftCatalog.query.js";

export class ListGiftCatalogHandler extends QueryHandler<ListGiftCatalogQuery, readonly GiftCatalogEntryDto[]> {
  public readonly queryType = "creators.listGiftCatalog" as const;

  public async execute(query: ListGiftCatalogQuery): Promise<readonly GiftCatalogEntryDto[]> {
    return presentGiftCatalog(query.displayCurrency);
  }
}
