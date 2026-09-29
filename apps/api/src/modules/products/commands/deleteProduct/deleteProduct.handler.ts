import { CommandHandler } from "@zudojs/cqrs";

import { publishEvent } from "../../../../loaders/events.loader.js";
import { ProductPublishedEvent } from "../../events/productPublished.event.js";
import type { ProductsService } from "../../services/products.service.js";
import type { DeleteProductCommand } from "./deleteProduct.command.js";

export class DeleteProductHandler extends CommandHandler<DeleteProductCommand, void> {
  public readonly commandType = "products.deleteProduct" as const;

  public constructor(private readonly productsService: ProductsService) {
    super();
  }

  public async execute(command: DeleteProductCommand): Promise<void> {
    const { products, events } = this.productsService.dependencies;
    const product = await this.productsService.findStoreProductForMember(command.principal.userId, command.storeId, command.productId);
    await products.updateStatus(product.id, "archived", product.publishedAt);
    await publishEvent(events, ProductPublishedEvent, { productId: product.id, storeId: product.storeId, published: false });
  }
}
