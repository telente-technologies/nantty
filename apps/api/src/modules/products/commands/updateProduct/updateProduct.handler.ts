import { CommandHandler } from "@zudojs/cqrs";

import { notFound } from "../../../../errors/domain.error.js";
import { publishEvent } from "../../../../loaders/events.loader.js";
import { ProductUpdatedEvent } from "../../events/productUpdated.event.js";
import type { ProductWithVariants } from "../../models/products.model.js";
import type { ProductsService } from "../../services/products.service.js";
import type { UpdateProductCommand } from "./updateProduct.command.js";

export class UpdateProductHandler extends CommandHandler<UpdateProductCommand, ProductWithVariants> {
  public readonly commandType = "products.updateProduct" as const;

  public constructor(private readonly productsService: ProductsService) {
    super();
  }

  public async execute(command: UpdateProductCommand): Promise<ProductWithVariants> {
    const { products, events } = this.productsService.dependencies;
    await this.productsService.findStoreProductForMember(command.principal.userId, command.storeId, command.productId);
    await this.productsService.assertCategoryExists(command.changes.categoryId);
    const { title, ...rest } = command.changes;
    const updated = await products.update(command.productId, { ...rest, ...(title === undefined ? {} : { title: title.trim() }) });
    if (updated === undefined) throw notFound("Product");
    await publishEvent(events, ProductUpdatedEvent, { productId: updated.id, storeId: updated.storeId });
    return this.productsService.loadProductWithVariants(updated);
  }
}
