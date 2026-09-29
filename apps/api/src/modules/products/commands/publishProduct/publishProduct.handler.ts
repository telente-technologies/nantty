import { CommandHandler } from "@zudojs/cqrs";

import { notFound, unprocessable } from "../../../../errors/domain.error.js";
import { publishEvent } from "../../../../loaders/events.loader.js";
import { ProductPublishedEvent } from "../../events/productPublished.event.js";
import type { ProductWithVariants } from "../../models/products.model.js";
import type { ProductsService } from "../../services/products.service.js";
import type { PublishProductCommand } from "./publishProduct.command.js";

export class PublishProductHandler extends CommandHandler<PublishProductCommand, ProductWithVariants> {
  public readonly commandType = "products.publishProduct" as const;

  public constructor(private readonly productsService: ProductsService) {
    super();
  }

  public async execute(command: PublishProductCommand): Promise<ProductWithVariants> {
    const { products, variants, events } = this.productsService.dependencies;
    const product = await this.productsService.findStoreProductForMember(command.principal.userId, command.storeId, command.productId);
    const productVariants = await variants.listForProducts([product.id]);
    if (productVariants.length === 0) throw unprocessable("Add at least one variant before publishing.");
    if (product.price <= 0 || productVariants.some((variant) => variant.price <= 0)) throw unprocessable("Set a price before publishing.");
    const published = await products.updateStatus(product.id, "published", product.publishedAt ?? new Date());
    if (published === undefined) throw notFound("Product");
    await publishEvent(events, ProductPublishedEvent, { productId: product.id, storeId: product.storeId, published: true });
    return { product: published, variants: productVariants };
  }
}
