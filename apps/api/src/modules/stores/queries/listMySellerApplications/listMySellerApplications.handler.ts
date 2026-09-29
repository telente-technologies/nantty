import { QueryHandler } from "@zudojs/cqrs";

import type { SellerApplicationDto } from "../../dtos/stores.dto.js";
import type { StoresService } from "../../services/stores.service.js";
import type { ListMySellerApplicationsQuery } from "./listMySellerApplications.query.js";

export class ListMySellerApplicationsHandler extends QueryHandler<ListMySellerApplicationsQuery, readonly SellerApplicationDto[]> {
  public readonly queryType = "stores.listMySellerApplications" as const;

  public constructor(private readonly storesService: StoresService) {
    super();
  }

  public async execute(query: ListMySellerApplicationsQuery): Promise<readonly SellerApplicationDto[]> {
    const applications = await this.storesService.dependencies.applications.listForUser(query.principal.userId);
    return Promise.all(applications.map((application) => this.storesService.convertApplicationWithDecryptedPhone(application)));
  }
}
