import { CommandHandler } from "@zudojs/cqrs";

import { notFound } from "../../../../errors/domain.error.js";
import { publishEvent } from "../../../../loaders/events.loader.js";
import { ProductPublishedEvent } from "../../events/productPublished.event.js";
import type { ProductWithVariants } from "../../models/products.model.js";
import type { ProductsService } from "../../services/products.service.js";
import type { UnpublishProductCommand } from "./unpublishProduct.command.js";

export class UnpublishProductHandler extends CommandHandler<UnpublishProductCommand, ProductWithVariants> {
  public readonly commandType = "products.unpublishProduct" as const;

  public constructor(private readonly productsService: ProductsService) {
    super();
  }

  public async execute(command: UnpublishProductCommand): Promise<ProductWithVariants> {
    const { products, events } = this.productsService.dependencies;
    const product = await this.productsService.findStoreProductForMember(command.principal.userId, command.storeId, command.productId);
    const draft = await products.updateStatus(product.id, "draft", product.publishedAt);
    if (draft === undefined) throw notFound("Product");
    await publishEvent(events, ProductPublishedEvent, { productId: product.id, storeId: product.storeId, published: false });
    return this.productsService.loadProductWithVariants(draft);
  }
}
