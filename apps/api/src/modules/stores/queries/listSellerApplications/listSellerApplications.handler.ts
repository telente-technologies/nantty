import { QueryHandler } from "@zudojs/cqrs";

import type { Page } from "../../../../types/pagination.type.js";
import type { SellerApplicationDto } from "../../dtos/stores.dto.js";
import type { StoresService } from "../../services/stores.service.js";
import type { ListSellerApplicationsQuery } from "./listSellerApplications.query.js";

export class ListSellerApplicationsHandler extends QueryHandler<ListSellerApplicationsQuery, Page<SellerApplicationDto>> {
  public readonly queryType = "stores.listSellerApplications" as const;

  public constructor(private readonly storesService: StoresService) {
    super();
  }

  public async execute(query: ListSellerApplicationsQuery): Promise<Page<SellerApplicationDto>> {
    const page = await this.storesService.dependencies.applications.list(query.status, query.page);
    const items = await Promise.all(page.data.map((application) => this.storesService.convertApplicationWithDecryptedPhone(application)));
    return { data: items, nextCursor: page.nextCursor };
  }
}
