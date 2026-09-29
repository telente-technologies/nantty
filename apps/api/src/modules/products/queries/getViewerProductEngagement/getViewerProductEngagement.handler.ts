import { QueryHandler } from "@zudojs/cqrs";

import type { ProductsService } from "../../services/products.service.js";
import type { GetViewerProductEngagementQuery } from "./getViewerProductEngagement.query.js";

export interface ViewerProductEngagement {
  readonly likedProductIds: ReadonlySet<string>;
  readonly bookmarkedProductIds: ReadonlySet<string>;
}

export class GetViewerProductEngagementHandler extends QueryHandler<GetViewerProductEngagementQuery, ViewerProductEngagement> {
  public readonly queryType = "products.getViewerProductEngagement" as const;

  public constructor(private readonly productsService: ProductsService) {
    super();
  }

  public async execute(query: GetViewerProductEngagementQuery): Promise<ViewerProductEngagement> {
    if (query.viewerId === undefined || query.productIds.length === 0) return { likedProductIds: new Set(), bookmarkedProductIds: new Set() };
    const { engagement } = this.productsService.dependencies;
    return {
      likedProductIds: await engagement.listEngagedProductIds("like", query.viewerId, query.productIds),
      bookmarkedProductIds: await engagement.listEngagedProductIds("bookmark", query.viewerId, query.productIds),
    };
  }
}
